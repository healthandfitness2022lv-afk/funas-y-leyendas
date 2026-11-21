// Utilidades puras (sin Firebase) — testeables en Node.

/** Normaliza RUT a "12345678-K". Devuelve null si es inválido (módulo 11). */
export function normalizarRut(input) {
  if (!input) return null;
  const limpio = String(input).toUpperCase().replace(/[^0-9K]/g, "");
  if (limpio.length < 8 || limpio.length > 9) return null;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d{7,8}$/.test(cuerpo)) return null;
  return dvRut(cuerpo) === dv ? `${cuerpo}-${dv}` : null;
}

export function dvRut(cuerpo) {
  let suma = 0, mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (suma % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}

/** Normaliza teléfono chileno a "56912345678". Acepta 912345678, +56 9 1234 5678, etc. */
export function normalizarTelefono(input) {
  if (!input) return null;
  let d = String(input).replace(/\D/g, "");
  if (d.length === 9 && d.startsWith("9")) d = "56" + d;
  if (d.length === 8) d = "569" + d;
  return /^[0-9]{8,12}$/.test(d) ? d : null;
}

/** Palabras del nombre en minúscula y sin tildes, para búsqueda array-contains. */
export function tokensNombre(nombre) {
  return [...new Set(
    quitarTildes(String(nombre || "").toLowerCase())
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 3)
  )].slice(0, 8);
}

export function quitarTildes(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // á -> a, ñ -> n
}

/** 12.345.678-K -> 12.345.***-K */
export function enmascararRut(rut) {
  if (!rut) return "";
  const [cuerpo, dv] = rut.split("-");
  const fmt = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return fmt.replace(/\d{3}$/, "***") + "-" + dv;
}

/** 56912345678 -> +56 9 **** 5678 */
export function enmascararTelefono(tel) {
  if (!tel) return "";
  const fin = tel.slice(-4);
  return tel.startsWith("569") ? `+56 9 **** ${fin}` : `****${fin}`;
}

/** Detecta qué tipo de búsqueda escribió el usuario. */
export function clasificarBusqueda(q) {
  const t = String(q || "").trim();
  if (!t) return null;
  const rut = /[kK]|-/.test(t) || /^\d{1,2}\.\d{3}\.\d{3}/.test(t) ? normalizarRut(t) : null;
  if (rut) return { tipo: "rut", valor: rut };
  const tel = /^[+\d\s()-]+$/.test(t) ? normalizarTelefono(t) : null;
  if (tel) return { tipo: "telefono", valor: tel };
  const rut2 = normalizarRut(t);
  if (rut2) return { tipo: "rut", valor: rut2 };
  const tokens = tokensNombre(t);
  if (tokens.length) return { tipo: "nombre", valor: tokens };
  return null;
}

export function extensionSegura(file) {
  const map = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  return map[file?.type] || null;
}

/**
 * Hash SHA-256 (hex) de un RUT o teléfono normalizado. Lo público guarda solo el hash
 * y la versión enmascarada; el dato real queda en reportes/{id}/privado/datos.
 */
export async function hashDato(valor) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(valor));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
