# Funas y Leyendas

Plataforma comunitaria para consultar y reportar malas prácticas en la compra-venta de cartas de Mitos y Leyendas.
Web estática (HTML + JS, sin build) + Firebase (Auth Google, Firestore, Storage, Hosting).

## Funciones (v0.1)
- **Buscar** por teléfono, RUT o nombre del titular (solo reportes *aprobados*). RUT y teléfono se muestran enmascarados.
- **Reportar** (requiere login Google): titular, RUT y/o teléfono, motivo, imagen de evidencia opcional (JPG/PNG/WEBP, < 5 MB). Entra como `pendiente`.
- **Moderación** (`/admin.html`): aprobar, rechazar o retirar reportes; ver descargos.
- **Descargo / derecho a réplica**: desde cada reporte.
- **Términos de uso** (borrador, revisar con abogado).

## Puesta en marcha
1. Crear proyecto en Firebase (ID sugerido `funas-y-leyendas`) y activar: Authentication (Google), Firestore, Storage, Hosting.
2. Pegar la config web en `public/js/firebase-config.js`.
3. `npm install` y `npx firebase login`.
4. Desplegar reglas e índices: `npx firebase deploy --only firestore,storage`.
5. Crear tu admin: entra a `/admin.html`, copia tu UID y crea en Firestore el doc `admins/{UID}` (desde la consola).
6. Hosting: `npx firebase deploy --only hosting`.

Local: `npm run serve` (emuladores) y abrir `public/` con cualquier servidor en `localhost` (se conecta solo a los emuladores).

## Pruebas
- `npm run test:utils` → validación de RUT, teléfono, máscaras y búsqueda.
- `npm run test:rules` → 25 pruebas de reglas Firestore/Storage en emulador (requiere Java).

## Modelo de datos
`reportes/{id}`: `titular`, `rut` (`12345678-K`), `telefono` (`569XXXXXXXX`), `motivo`, `evidenciaPath`, `nombreTokens[]`, `estado` (`pendiente|aprobado|rechazado|retirado`), `creadoPor`, `creadoEn`, `aceptaTerminos`, `notaModeracion`, `moderadoPor`, `moderadoEn`.
`descargos/{id}`: `reporteId`, `mensaje`, `contacto`, `creadoPor`, `creadoEn` (solo admin lee).
`admins/{uid}`: se crea a mano en la consola.
Storage: `evidencias/{uid}/{reporteId}/evidencia.{ext}`.

## Seguridad (reglas)
- Público solo lee reportes `aprobado`. Nadie puede autoaprobarse ni suplantar autor.
- Esquema estricto (campos permitidos, largos, formato RUT/teléfono). Admin solo cambia estado/nota, no el contenido.
- Evidencia: sube solo el dueño, solo imágenes < 5 MB, sin sobrescribir; la ven autor, admin o usuarios logueados si el reporte está aprobado.
- Todo lo demás denegado.

## Riesgos legales y mitigaciones
Publicar RUT/teléfono junto a acusaciones expone a demandas por **injurias/calumnias** (Código Penal art. 412 y ss.) y a la **ley de datos personales** (19.628, modificada por la 21.719, plena vigencia dic-2026).
Mitigaciones incluidas: moderación previa, login obligatorio, declaración de veracidad, datos enmascarados, evidencia solo para usuarios logueados, derecho a réplica y retiro, términos de uso.
Pendiente recomendado: revisión de términos por abogado, correo de contacto real, App Check + límite de reportes por usuario, política de retención (borrar reportes antiguos/resueltos).

## Valoración
**CLP $550.000** (v0.1: web + auth + moderación + storage + reglas probadas).
