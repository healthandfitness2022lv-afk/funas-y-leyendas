import { db, storage, auth, el, montarSesion, mostrarError, fecha } from "./app.js";
import {
  collection, query, where, getDocs, getDoc, doc, limit
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { clasificarBusqueda, hashDato } from "./utils.js";

montarSesion();

const form = document.getElementById("form-buscar");
const lista = document.getElementById("resultados");

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const q = clasificarBusqueda(form.q.value);
  lista.replaceChildren();
  if (!q) { lista.append(el("p", { class: "muted" }, "Escribe un teléfono, RUT (con guion) o nombre.")); return; }

  lista.append(el("p", { class: "muted" }, "Buscando…"));
  try {
    const base = collection(db, "reportes");
    let docs;
    if (q.tipo === "nombre") {
      const clave = [...q.valor].sort((a, b) => b.length - a.length)[0];
      const snap = await getDocs(query(base, where("estado", "==", "aprobado"), where("nombreTokens", "array-contains", clave), limit(50)));
      docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      // RUT/teléfono: índice por hash -> IDs de reporte -> solo se leen los aprobados.
      const idx = await getDocs(query(collection(db, "indice", await hashDato(q.valor), "r"), limit(50)));
      const leidos = await Promise.all(idx.docs.map((d) => getDoc(doc(db, "reportes", d.id)).catch(() => null)));
      docs = leidos.filter((d) => d?.exists() && d.data().estado === "aprobado").map((d) => ({ id: d.id, ...d.data() }));
    }
    if (q.tipo === "nombre") docs = docs.filter((d) => q.valor.every((t) => d.nombreTokens?.includes(t)));
    docs.sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0));
    pintar(docs);
  } catch (e) { lista.replaceChildren(); mostrarError(e); }
});

function pintar(docs) {
  lista.replaceChildren();
  if (!docs.length) {
    lista.append(el("p", { class: "ok-msg" }, "Sin reportes aprobados para esta búsqueda."),
      el("p", { class: "muted" }, "Que no haya reportes no garantiza que la persona sea confiable."));
    return;
  }
  lista.append(el("p", {}, `${docs.length} reporte(s) encontrado(s):`));
  for (const d of docs) {
    const card = el("article", { class: "card" },
      el("h3", {}, d.titular),
      el("dl", {},
        d.rutMask ? el("div", {}, el("dt", {}, "RUT"), el("dd", {}, d.rutMask)) : null,
        d.telMask ? el("div", {}, el("dt", {}, "Teléfono"), el("dd", {}, d.telMask)) : null,
        el("div", {}, el("dt", {}, "Fecha"), el("dd", {}, fecha(d.creadoEn)))
      ),
      el("p", { class: "motivo" }, d.motivo),
    );
    if (d.evidenciaPath) {
      const btn = el("button", { class: "btn-link" }, "Ver evidencia");
      btn.addEventListener("click", async () => {
        if (!auth.currentUser) { mostrarError(new Error("Inicia sesión para ver la evidencia.")); return; }
        try {
          const url = await getDownloadURL(ref(storage, d.evidenciaPath));
          btn.replaceWith(el("img", { src: url, alt: "Evidencia del reporte", class: "evidencia", loading: "lazy" }));
        } catch (e) { mostrarError(e); }
      });
      card.append(btn);
    }
    card.append(el("a", { class: "descargo", href: `descargo.html?id=${encodeURIComponent(d.id)}` },
      "¿Eres tú? Solicita tu descargo"));
    lista.append(card);
  }
}
