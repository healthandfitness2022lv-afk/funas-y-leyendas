// Config web pública del proyecto Firebase (no es secreta: la seguridad está en las reglas).
export const firebaseConfig = {
  apiKey: "AIzaSyA_zwfv0ZvarN71W9duIwGb0AVmbAH9Wkw",
  authDomain: "funas-y-leyendas.firebaseapp.com",
  projectId: "funas-y-leyendas",
  storageBucket: "funas-y-leyendas.firebasestorage.app",
  messagingSenderId: "813237484295",
  appId: "1:813237484295:web:563d46940ee4ea61e823a2"
};
// true = conectar a emuladores locales (firebase emulators:start)
export const USE_EMULATORS = location.hostname === "localhost" || location.hostname === "127.0.0.1";
