import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { firebaseConfig, USE_EMULATORS } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (USE_EMULATORS) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

export const login = () => signInWithPopup(auth, new GoogleAuthProvider());
export const logout = () => signOut(auth);

/** Crea un elemento con texto seguro (nunca innerHTML con datos de usuario). */
export function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const h of hijos) if (h != null) n.append(h instanceof Node ? h : String(h));
  return n;
}

/** Pinta el botón de sesión en el header y avisa cambios de usuario. */
export function montarSesion(cb) {
  const cont = document.getElementById("sesion");
  onAuthStateChanged(auth, (user) => {
    if (cont) {
      cont.replaceChildren(
        user
          ? el("span", {}, el("small", {}, user.displayName || user.email || "Conectado"), " ",
              el("button", { class: "btn-link", onclick: logout }, "Salir"))
          : el("button", { class: "btn", onclick: () => login().catch(mostrarError) }, "Entrar con Google")
      );
    }
    cb?.(user);
  });
}

export function mostrarError(e) {
  console.error(e);
  const box = document.getElementById("aviso");
  if (box) { box.className = "aviso error"; box.textContent = e?.message || String(e); }
}

export function mostrarAviso(msg) {
  const box = document.getElementById("aviso");
  if (box) { box.className = "aviso ok"; box.textContent = msg; }
}

export function fecha(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? d.toLocaleDateString("es-CL") : "";
}
