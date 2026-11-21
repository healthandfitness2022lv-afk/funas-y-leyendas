import { db, storage, auth, montarSesion, mostrarError, mostrarAviso } from "./app.js";
import {
  collection, doc, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { normalizarRut, normalizarTelefono, tokensNombre, extensionSegura, hashDato, enmascararRut, enmascararTelefono } from "./utils.js";

const form = document.getElementById("form-reporte");
const bloqueo = document.getElementById("requiere-login");

montarSesion((user) => {
  form.hidden = !user;
  bloqueo.hidden = !!user;
});

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const user = auth.currentUser;
  if (!user) return mostrarError(new Error("Debes iniciar sesión."));

  const f = form.elements;
  const titular = f.titular.value.trim();
  const motivo = f.motivo.value.trim();
  const telIn = f.telefono.value.trim();
  const rutIn = f.rut.value.trim();
  const telefono = telIn ? normalizarTelefono(telIn) : null;
  const rut = rutIn ? normalizarRut(rutIn) : null;
  const archivo = f.evidencia.files[0];

  if (telIn && !telefono) return mostrarError(new Error("Teléfono inválido."));
  if (rutIn && !rut) return mostrarError(new Error("RUT inválido (revisa el dígito verificador)."));
  if (!telefono && !rut) return mostrarError(new Error("Ingresa al menos teléfono o RUT."));
  if (titular.length < 3) return mostrarError(new Error("Ingresa el nombre del titular de la cuenta."));
  if (motivo.length < 20) return mostrarError(new Error("Describe el motivo (mínimo 20 caracteres)."));
  if (!f.terminos.checked) return mostrarError(new Error("Debes aceptar los términos."));
  if (archivo) {
    if (!extensionSegura(archivo)) return mostrarError(new Error("La evidencia debe ser JPG, PNG o WEBP."));
    if (archivo.size >= 5 * 1024 * 1024) return mostrarError(new Error("La imagen debe pesar menos de 5 MB."));
  }

  const boton = form.querySelector("button[type=submit]");
  boton.disabled = true;
  try {
    const docRef = doc(collection(db, "reportes"));
    const data = {
      titular, motivo,
      nombreTokens: tokensNombre(titular),
      estado: "pendiente",
      creadoPor: user.uid,
      creadoEn: serverTimestamp(),
      aceptaTerminos: true,
    };
    const privado = {};
    if (telefono) { data.telHash = await hashDato(telefono); data.telMask = enmascararTelefono(telefono); privado.telefono = telefono; }
    if (rut) { data.rutHash = await hashDato(rut); data.rutMask = enmascararRut(rut); privado.rut = rut; }
    if (archivo) {
      const path = `evidencias/${user.uid}/${docRef.id}/evidencia.${extensionSegura(archivo)}`;
      await uploadBytes(ref(storage, path), archivo, { contentType: archivo.type });
      data.evidenciaPath = path;
    }
    // Público (hash + máscara) y privado (dato real) en una sola escritura atómica.
    const lote = writeBatch(db);
    lote.set(docRef, data);
    lote.set(doc(db, "reportes", docRef.id, "privado", "datos"), privado);
    await lote.commit();
    form.reset();
    mostrarAviso("Reporte enviado. Será revisado por moderación antes de publicarse.");
  } catch (e) {
    mostrarError(e);
  } finally {
    boton.disabled = false;
  }
});
