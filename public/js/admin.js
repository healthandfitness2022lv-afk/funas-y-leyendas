import { db, storage, auth, el, montarSesion, mostrarError, fecha } from "./app.js";
import {
  collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const panel = document.getElementById("panel");
const filtro = document.getElementById("filtro");

montarSesion(async (user) => {
  panel.replaceChildren();
  if (!user) { panel.append(el("p", {}, "Inicia sesión como administrador.")); return; }
  const adm = await getDoc(doc(db, "admins", user.uid)).catch(() => null);
  if (!adm?.exists()) { panel.append(el("p", {}, `Sin permisos. Tu UID: ${user.uid}`)); return; }
  filtro.hidden = false;
  cargar();
});

filtro.addEventListener("change", cargar);

async function cargar() {
  panel.replaceChildren(el("p", { class: "muted" }, "Cargando…"));
  try {
    if (filtro.value === "descargos") return cargarDescargos();
    const snap = await getDocs(query(collection(db, "reportes"), where("estado", "==", filtro.value), limit(100)));
    panel.replaceChildren();
    if (snap.empty) panel.append(el("p", { class: "muted" }, "Nada por aquí."));
    snap.forEach((d) => panel.append(tarjeta(d.id, d.data())));
  } catch (e) { mostrarError(e); }
}

function tarjeta(id, d) {
  const card = el("article", { class: "card" },
    el("h3", {}, d.titular),
    el("p", {}, `RUT: ${d.rut || "—"} · Tel: ${d.telefono || "—"} · ${fecha(d.creadoEn)} · ID ${id}`),
    el("p", { class: "motivo" }, d.motivo),
  );
  if (d.evidenciaPath) {
    getDownloadURL(ref(storage, d.evidenciaPath))
      .then((url) => card.insertBefore(el("img", { src: url, alt: "Evidencia", class: "evidencia" }), acciones))
      .catch(() => {});
  }
  const nota = el("input", { placeholder: "Nota de moderación (opcional)", maxlength: "300" });
  const acciones = el("div", { class: "acciones" }, nota,
    ...["aprobado", "rechazado", "retirado"].filter((e) => e !== d.estado).map((estado) =>
      el("button", { class: estado === "aprobado" ? "btn" : "btn sec", onclick: () => mover(id, estado, nota.value) },
        { aprobado: "Aprobar", rechazado: "Rechazar", retirado: "Retirar" }[estado])));
  card.append(acciones);
  return card;
}

async function mover(id, estado, nota) {
  try {
    await updateDoc(doc(db, "reportes", id), {
      estado, notaModeracion: nota.slice(0, 300), moderadoPor: auth.currentUser.uid, moderadoEn: serverTimestamp(),
    });
    cargar();
  } catch (e) { mostrarError(e); }
}

async function cargarDescargos() {
  const snap = await getDocs(query(collection(db, "descargos"), limit(100)));
  panel.replaceChildren();
  if (snap.empty) panel.append(el("p", { class: "muted" }, "Sin descargos."));
  snap.forEach((d) => {
    const x = d.data();
    panel.append(el("article", { class: "card" },
      el("h3", {}, `Reporte ${x.reporteId}`),
      el("p", { class: "motivo" }, x.mensaje),
      el("p", {}, `Contacto: ${x.contacto} · ${fecha(x.creadoEn)}`)));
  });
}
