// Reemplazar con la config del proyecto Firebase (Consola > Configuración del proyecto > Tus apps > Web).
export const firebaseConfig = {
  apiKey: "REEMPLAZAR",
  authDomain: "funas-y-leyendas.firebaseapp.com",
  projectId: "funas-y-leyendas",
  storageBucket: "funas-y-leyendas.appspot.com",
  messagingSenderId: "REEMPLAZAR",
  appId: "REEMPLAZAR"
};
// true = conectar a emuladores locales (firebase emulators:start)
export const USE_EMULATORS = location.hostname === "localhost" || location.hostname === "127.0.0.1";
