import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, getDocs, query, collection, where, serverTimestamp, addDoc } from "firebase/firestore";
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

const valido = (uid, extra = {}) => ({
  titular: "Juan Pérez", motivo: "Le transferí 20 mil y nunca envió las cartas.",
  nombreTokens: ["juan", "perez"], estado: "pendiente", creadoPor: uid,
  creadoEn: serverTimestamp(), aceptaTerminos: true, rut: "12345678-5", telefono: "56912345678", ...extra,
});
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

test("anónimo no puede reportar", () => assertFails(setDoc(doc(fs(null), "reportes/r1"), valido("x"))));
test("usuario con login reporta como pendiente", () => assertSucceeds(setDoc(doc(fs("u1"), "reportes/r1"), valido("u1"))));
test("no puede autoaprobarse", () => assertFails(setDoc(doc(fs("u1"), "reportes/r1"), valido("u1", { estado: "aprobado" }))));
test("no puede suplantar a otro autor", () => assertFails(setDoc(doc(fs("u1"), "reportes/r1"), valido("u2"))));
test("campos extra rechazados", () => assertFails(setDoc(doc(fs("u1"), "reportes/r1"), valido("u1", { hack: 1 }))));
test("RUT mal formado rechazado", () => assertFails(setDoc(doc(fs("u1"), "reportes/r1"), valido("u1", { rut: "1-2-3" }))));
test("requiere RUT o teléfono", async () => {
  const d = valido("u1"); delete d.rut; delete d.telefono;
  await assertFails(setDoc(doc(fs("u1"), "reportes/r1"), d));
});
test("evidenciaPath debe ser propia", () => assertFails(setDoc(doc(fs("u1"), "reportes/r1"), valido("u1", { evidenciaPath: "evidencias/u2/r1/a.jpg" }))));
test("evidenciaPath propia OK", () => assertSucceeds(setDoc(doc(fs("u1"), "reportes/r1"), valido("u1", { evidenciaPath: "evidencias/u1/r1/evidencia.jpg" }))));

test("público lee aprobados", () => assertSucceeds(getDoc(doc(fs(null), "reportes/aprob"))));
test("público NO lee pendientes", () => assertFails(getDoc(doc(fs(null), "reportes/pend"))));
test("query pública filtrada por aprobado OK", () => assertSucceeds(getDocs(query(collection(fs(null), "reportes"), where("estado", "==", "aprobado"), where("rut", "==", "12345678-5")))));
test("query pública sin filtro falla", () => assertFails(getDocs(query(collection(fs(null), "reportes"), where("rut", "==", "12345678-5")))));

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
