# Plan de pruebas — AutoDamage AI

Matriz de trazabilidad Requerimiento Funcional → Caso de Prueba.

| Requerimiento | Descripción                                                              | Caso de prueba                                       | Estado      |
| ------------- | ------------------------------------------------------------------------ | ---------------------------------------------------- | ----------- |
| RF01          | Registro e inicio de sesión por roles                                    | CP05 (parcial) + unitarios de validadores (Sprint 1) | En progreso |
| RF02          | Captura de datos del siniestro (vehículo, fecha, ubicación, descripción) | CP05                                                 | Pendiente   |
| RF03          | Captura en vivo de fotos (cámara, sin galería)                           | CP01, CP04                                           | Pendiente   |
| RF04          | Metadatos adjuntos (GPS, hora, user-agent)                               | CP04                                                 | Pendiente   |
| RF05          | Análisis de daños con IA multimodal                                      | CP02, CP03, CP06                                     | Pendiente   |
| RF06          | Triaje y asignación de ruta (verde/amarilla/roja)                        | CP02, CP03                                           | Pendiente   |
| RF07          | Orden de trabajo automática en ruta verde                                | CP03, CP05                                           | Pendiente   |
| RF08          | Dashboard del perito (bandeja, detalle, cajas de daño)                   | CP04, CP05                                           | Pendiente   |
| RF09          | Dictamen del perito (aprobar/ajustar/rechazar/ampliar)                   | CP05                                                 | Pendiente   |
| RF10          | Portal del taller (órdenes y estados)                                    | CP05                                                 | Pendiente   |
| RF11          | Reporte PDF del expediente (Could)                                       | —                                                    | Pendiente   |
| RF12          | Auditoría inmutable de decisiones                                        | CP05 + unitarios                                     | Pendiente   |
| RF13          | Difuminado de rostros en el navegador                                    | CP04                                                 | Pendiente   |

## Casos de prueba

### CP01 — Carga de archivo/galería bloqueada

- **Objetivo:** verificar que no se puede evadir la captura en vivo subiendo un archivo de galería o cámara.
- **Pasos:** (1) intentar subir un archivo con EXIF de cámara vía API → se espera rechazo `422 ARCHIVO_NO_EN_VIVO`; (2) verificar que la UI de captura no expone `input[type=file]`.
- **Sprint:** 3 (validación), 5 (documentación con evidencia).
- **Resultado:** pendiente.

### CP02 — Foto de pantalla (recaptura)

- **Objetivo:** una foto de un choque mostrada en pantalla → ruta ROJA por `SOSPECHA_RECAPTURA`.
- **Datos:** fotos del set de validación marcadas `es_recaptura=true`.
- **Resultado:** pendiente.

### CP03 — Faro roto, metadatos válidos, costo < 500 USD

- **Objetivo:** análisis de faro roto con GPS/hora consistentes → ruta VERDE y orden de trabajo creada automáticamente.
- **Resultado:** pendiente.

### CP04 — Flujo end-to-end en entorno desplegado

- **Objetivo:** desde un teléfono real (≥ 1 iOS, ≥ 2 Android): registro → captura con cámara → difuminado de rostros → GPS → análisis → resultado de ruta.
- **Resultado:** pendiente.

### CP05 — CRUD y flujos de estado

- **Objetivo:** CRUD de usuarios (registro), vehículos y siniestros; transiciones de orden de trabajo (EMITIDA → RECIBIDO → EN_REPARACION → COMPLETADO → siniestro FINALIZADO); dictamen del perito.
- **Resultado:** pendiente.

### CP06 — Rendimiento y usabilidad

- **Objetivo:** tiempos de carga de pantallas, adaptabilidad móvil de la cámara, análisis de IA < 10 s (p95).
- **Resultado:** pendiente.

## Set de validación de la IA

- Ubicación: `tests/validation/imagenes/` (no versionado si contiene datos personales).
- Etiquetado: `tests/validation/etiquetas.csv` (columnas: `archivo,severidad,piezas,es_recaptura`; piezas separadas por `|`; doble etiquetado).
- Meta: 60–100 fotos.
- Script de evaluación: `scripts/evaluar-ia.ts` (Sprint 5).
