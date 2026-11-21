import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, getDocs, query, collection, where, serverTimestamp, addDoc, writeBatch } from "firebase/firestore";
import { hashDato } from "../public/js/utils.js";
import { ref, uploadBytes, getBytes } from "firebase/storage";

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-funas",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "admins/admin1"), { ok: true });
    await setDoc(doc(db, "reportes/aprob"), { estado: "aprobado", titular: "X", creadoPor: "otro" });
    await setDoc(doc(db, "reportes/pend"), { estado: "pendiente", titular: "Y", creadoPor: "otro" });
  });
});

const RUT = "12345678-5", TEL = "56912345678";
const valido = (uid, extra = {}) => ({
  titular: "Juan Pérez", motivo: "Le transferí 20 mil y nunca envió las cartas.",
  nombreTokens: ["juan", "perez"], estado: "pendiente", creadoPor: uid,
  creadoEn: serverTimestamp(), aceptaTerminos: true,
  rutMask: "**.***.***-5", telMask: "+56 9 **** **78", ...extra,
});
/** Crea público + privado + índice en un lote, como hace la app. */
const crear = async (uid, id, pub, priv = { rut: RUT, telefono: TEL }, indice = null) => {
  const db = fs(uid); const b = writeBatch(db);
  b.set(doc(db, "reportes", id), pub);
  if (priv) b.set(doc(db, "reportes", id, "privado", "datos"), priv);
  for (const v of indice ?? Object.values(priv || {})) b.set(doc(db, "indice", await hashDato(v), "r", id), {});
  return b.commit();
};
// Un contexto por uid (reutilizado): el SDK no permite re-configurar la misma instancia.
const ctxs = new Map();
const ctx = (uid) => {
  const k = uid || "__anon";
  if (!ctxs.has(k)) ctxs.set(k, uid ? env.authenticatedContext(uid) : env.unauthenticatedContext());
  return ctxs.get(k);
};
const cache = new Map();
const memo = (k, f) => (cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k)));
const fs = (uid) => memo("fs:" + uid, () => ctx(uid).firestore());
const st = (uid) => memo("st:" + uid, () => ctx(uid).storage());

test("anónimo no puede reportar", () => assertFails(crear(null, "r1", valido("x"))));
test("usuario con login reporta como pendiente", () => assertSucceeds(crear("u1", "r1", valido("u1"))));
test("no puede autoaprobarse", () => assertFails(crear("u1", "r1", valido("u1", { estado: "aprobado" }))));
test("no puede suplantar a otro autor", () => assertFails(crear("u1", "r1", valido("u2"))));
test("campos extra rechazados", () => assertFails(crear("u1", "r1", valido("u1", { hack: 1 }))));
test("máscara que revela dígitos rechazada", () => assertFails(crear("u1", "r1", valido("u1", { rutMask: "12.345.***-5" }))));
test("requiere RUT o teléfono", async () => {
  const d = valido("u1"); delete d.rutMask; delete d.telMask;
  await assertFails(crear("u1", "r1", d, {}));
});
test("evidenciaPath debe ser propia", () => assertFails(crear("u1", "r1", valido("u1", { evidenciaPath: "evidencias/u2/r1/a.jpg" }))));
test("evidenciaPath propia OK", () => assertSucceeds(crear("u1", "r1", valido("u1", { evidenciaPath: "evidencias/u1/r1/evidencia.jpg" }))));

test("público lee aprobados", () => assertSucceeds(getDoc(doc(fs(null), "reportes/aprob"))));
test("público NO lee pendientes", () => assertFails(getDoc(doc(fs(null), "reportes/pend"))));
test("query pública filtrada por aprobado OK", () => assertSucceeds(getDocs(query(collection(fs(null), "reportes"), where("estado", "==", "aprobado"), where("nombreTokens", "array-contains", "juan")))));
test("query pública sin filtro falla", () => assertFails(getDocs(query(collection(fs(null), "reportes"), where("nombreTokens", "array-contains", "juan")))));

test("usuario no puede aprobar", () => assertFails(updateDoc(doc(fs("u1"), "reportes/pend"), { estado: "aprobado" })));
test("admin aprueba", () => assertSucceeds(updateDoc(doc(fs("admin1"), "reportes/pend"), { estado: "aprobado" })));
test("admin no puede alterar el contenido", () => assertFails(updateDoc(doc(fs("admin1"), "reportes/pend"), { titular: "Otro" })));
test("nadie se autoasigna admin", () => assertFails(setDoc(doc(fs("u1"), "admins/u1"), { ok: true })));

test("descargo con login OK", () => assertSucceeds(addDoc(collection(fs("u1"), "descargos"), {
  reporteId: "aprob", mensaje: "Yo sí envié las cartas, tengo el seguimiento.", contacto: "a@b.cl", creadoPor: "u1", creadoEn: serverTimestamp() })));
test("descargos no son públicos", () => assertFails(getDocs(collection(fs("u1"), "descargos"))));

const img = new Uint8Array([137, 80, 78, 71]);
test("storage: subir imagen propia", () => assertSucceeds(uploadBytes(ref(st("u1"), "evidencias/u1/r1/e.png"), img, { contentType: "image/png" })));
test("storage: no subir en carpeta ajena", () => assertFails(uploadBytes(ref(st("u1"), "evidencias/u2/r1/e.png"), img, { contentType: "image/png" })));
test("storage: no subir no-imagen", () => assertFails(uploadBytes(ref(st("u1"), "evidencias/u1/r1/e.html"), img, { contentType: "text/html" })));
test("storage: anónimo no sube", () => assertFails(uploadBytes(ref(st(null), "evidencias/u1/r1/e.png"), img, { contentType: "image/png" })));
test("storage: evidencia de pendiente no visible a terceros", async () => {
  await env.withSecurityRulesDisabled((c) => uploadBytes(ref(c.storage(), "evidencias/otro/pend/e.png"), img, { contentType: "image/png" }));
  await assertFails(getBytes(ref(st("u9"), "evidencias/otro/pend/e.png")));
});
test("storage: evidencia de aprobado visible con login", async () => {
  await env.withSecurityRulesDisabled((c) => uploadBytes(ref(c.storage(), "evidencias/otro/aprob/e.png"), img, { contentType: "image/png" }));
  await assertSucceeds(getBytes(ref(st("u9"), "evidencias/otro/aprob/e.png")));
});

test("sin doc privado en el lote se rechaza", () => assertFails(crear("u1", "r1", valido("u1"), null)));
test("índice con hash que no coincide se rechaza", () => assertFails(crear("u1", "r1", valido("u1"), { rut: RUT, telefono: TEL }, [RUT, TEL, "11111111-1"])));
test("dato privado sin índice se rechaza", () => assertFails(crear("u1", "r1", valido("u1"), { rut: RUT, telefono: TEL }, [RUT])));
test("índice no se puede agregar a un reporte existente", async () => {
  await assertFails(setDoc(doc(fs("u1"), "indice", await hashDato("11111111-1"), "r", "pend"), {}));
});
test("búsqueda pública por índice y sin hashes en el doc público", async () => {
  await crear("u1", "r3", valido("u1"));
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), "reportes/r3"), { estado: "aprobado" }));
  const idx = await assertSucceeds(getDocs(collection(fs(null), "indice", await hashDato(RUT), "r")));
  if (idx.docs.map((d) => d.id).join() !== "r3") throw new Error("índice inesperado");
  const pub = await assertSucceeds(getDoc(doc(fs(null), "reportes/r3")));
  const json = JSON.stringify(pub.data());
  if (json.includes("12345678") || /[0-9a-f]{64}/.test(json)) throw new Error("dato sensible en público: " + json);
});
test("falta un dato privado declarado en público", () => assertFails(crear("u1", "r1", valido("u1"), { rut: RUT })));
test("RUT real en el doc público se rechaza", () => assertFails(crear("u1", "r1", valido("u1", { rut: RUT }))));
test("público no lee datos privados de aprobados", async () => {
  await crear("u1", "r2", valido("u1"));
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), "reportes/r2"), { estado: "aprobado" }));
  await assertSucceeds(getDoc(doc(fs(null), "reportes/r2")));
  await assertFails(getDoc(doc(fs(null), "reportes/r2/privado/datos")));
  await assertFails(getDoc(doc(fs("u9"), "reportes/r2/privado/datos")));
  await assertSucceeds(getDoc(doc(fs("u1"), "reportes/r2/privado/datos")));
  await assertSucceeds(getDoc(doc(fs("admin1"), "reportes/r2/privado/datos")));
});
test("no se puede agregar privado a un reporte existente", () =>
  assertFails(setDoc(doc(fs("u1"), "reportes/pend/privado/datos"), { rut: RUT })));
