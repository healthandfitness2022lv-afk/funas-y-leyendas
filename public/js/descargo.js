import { db, auth, montarSesion, mostrarError, mostrarAviso } from "./app.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const form = document.getElementById("form-descargo");
const bloqueo = document.getElementById("requiere-login");
const reporteId = new URLSearchParams(location.search).get("id") || "";
form.elements.reporteId.value = reporteId;

montarSesion((user) => { form.hidden = !user; bloqueo.hidden = !!user; });

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = form.elements;
  const mensaje = f.mensaje.value.trim();
  const contacto = f.contacto.value.trim();
  if (!f.reporteId.value) return mostrarError(new Error("Falta el ID del reporte."));
  if (mensaje.length < 20) return mostrarError(new Error("Explica tu descargo (mínimo 20 caracteres)."));
  if (contacto.length < 5) return mostrarError(new Error("Indica un correo o teléfono de contacto."));
  try {
    await addDoc(collection(db, "descargos"), {
      reporteId: f.reporteId.value, mensaje, contacto,
      creadoPor: auth.currentUser.uid, creadoEn: serverTimestamp(),
    });
    form.reset(); f.reporteId.value = reporteId;
    mostrarAviso("Descargo enviado. Moderación lo revisará y podrá retirar el reporte.");
  } catch (e) { mostrarError(e); }
});
