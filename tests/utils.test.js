import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarRut, normalizarTelefono, tokensNombre, enmascararRut, enmascararTelefono, clasificarBusqueda } from "../public/js/utils.js";

test("RUT", () => {
  assert.equal(normalizarRut("12.345.678-5"), "12345678-5");
  assert.equal(normalizarRut("11.111.111-1"), "11111111-1");
  assert.equal(normalizarRut("12.345.678-K"), null);
  assert.equal(normalizarRut("abc"), null);
  assert.equal(normalizarRut("7.654.321-6"), "7654321-6");
});
test("Teléfono", () => {
  assert.equal(normalizarTelefono("+56 9 1234 5678"), "56912345678");
  assert.equal(normalizarTelefono("912345678"), "56912345678");
  assert.equal(normalizarTelefono("123"), null);
});
test("Tokens", () => {
  assert.deepEqual(tokensNombre("José Ñuñez de la Peña"), ["jose", "nunez", "pena"]);
});
test("Máscaras", () => {
  assert.equal(enmascararRut("12345678-5"), "12.345.***-5");
  assert.equal(enmascararTelefono("56912345678"), "+56 9 **** 5678");
});
test("Clasificar búsqueda", () => {
  assert.deepEqual(clasificarBusqueda("12.345.678-5"), { tipo: "rut", valor: "12345678-5" });
  assert.deepEqual(clasificarBusqueda("+56 9 1234 5678"), { tipo: "telefono", valor: "56912345678" });
  assert.equal(clasificarBusqueda("Juan Pérez").tipo, "nombre");
});
