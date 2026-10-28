# Contrato de la API — AutoDamage AI

Base: `/api`. Los errores siempre responden en el formato:

```json
{ "error": { "code": "CODIGO", "message": "Mensaje legible", "details": {} } }
```

## Autenticación

Sesión por cookie JWT de Supabase. Toda ruta de API verifica sesión y rol.

| Código             | HTTP | Significado                                        |
| ------------------ | ---- | -------------------------------------------------- |
| `NO_AUTENTICADO`   | 401  | Sin sesión válida                                  |
| `SIN_PERMISO`      | 403  | El rol no puede acceder al recurso                 |
| `VALIDACION_ERROR` | 400  | Fallo de validación Zod (`details` con los issues) |
| `ERROR_INTERNO`    | 500  | Error inesperado (no filtra información interna)   |

## Vehículos

| Método | Ruta             | Rol       | Entrada                                     | Salida             |
| ------ | ---------------- | --------- | ------------------------------------------- | ------------------ |
| `POST` | `/api/vehiculos` | ASEGURADO | `{matricula, marca, modelo, numero_poliza}` | `201` vehículo     |
| `GET`  | `/api/vehiculos` | ASEGURADO | —                                           | lista de vehículos |

## Siniestros

| Método | Ruta                           | Rol                    | Entrada                                                                                                                                 | Salida                                                                       |
| ------ | ------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `POST` | `/api/siniestros`              | ASEGURADO              | `{vehiculo_id, descripcion?, latitud, longitud, fecha_incidente}`                                                                       | `201 {id, estado:"PENDIENTE"}`                                               |
| `GET`  | `/api/siniestros/:id`          | dueño / PERITO / ADMIN | —                                                                                                                                       | siniestro + imágenes (URLs firmadas 60 min) + inspección + evaluaciones      |
| `POST` | `/api/siniestros/:id/imagenes` | ASEGURADO (dueño)      | `multipart/form-data`: `file` (JPEG ≤ 1.5 MB), `capturada_en`, `latitud`, `longitud`, `precision_gps_m`, `orden`, `rostros_difuminados` | `201 {imagen_id}`                                                            |
| `POST` | `/api/siniestros/:id/analizar` | ASEGURADO (dueño)      | — (requiere ≥ 1 imagen)                                                                                                                 | `202 {analisis_estado:"EN_PROCESO"}`; ejecuta en segundo plano con `after()` |

### Códigos de error específicos

| Código                     | HTTP | Cuándo                                 |
| -------------------------- | ---- | -------------------------------------- |
| `VEHICULO_NO_ENCONTRADO`   | 404  | El vehículo no existe                  |
| `VEHICULO_AJENO`           | 403  | El vehículo no pertenece al asegurado  |
| `SINIESTRO_NO_ENCONTRADO`  | 404  | El siniestro no existe                 |
| `SINIESTRO_AJENO`          | 403  | El siniestro no pertenece al usuario   |
| `ESTADO_INVALIDO`          | 409  | El siniestro ya fue analizado          |
| `TIPO_ARCHIVO_INVALIDO`    | 415  | Solo se acepta `image/jpeg`            |
| `ARCHIVO_DEMASIADO_GRANDE` | 413  | > 1.5 MB                               |
| `LIMITE_IMAGENES`          | 409  | Máximo 5 imágenes por siniestro        |
| `ARCHIVO_NO_EN_VIVO`       | 422  | La imagen tiene EXIF de cámara/galería |
| `ARCHIVO_FALTANTE`         | 400  | Falta el archivo en el multipart       |
| `SIN_IMAGENES`             | 409  | No hay imágenes para analizar          |
| `ANALISIS_YA_COMPLETADO`   | 409  | El siniestro ya tiene análisis         |

## Límites de IA

- Cuota diaria: `DAILY_AI_QUOTA_LIMIT` inspecciones `DIGITAL_IA` por día.
- Límite por minuto: `AI_MAX_RPM` (token bucket en memoria).
- Si se excede cualquiera: degradación a ruta AMARILLA con etiqueta `IA_NO_DISPONIBLE`
  (nunca se bloquea el siniestro).

## Modelo de datos de la respuesta de detalle

```jsonc
{
  "siniestro": { "id", "aseguradoId", "vehiculoId", "estado", "ruta",
                 "analisisEstado", "etiquetas": [], "requiereInspeccionPresencial",
                 "fechaIncidente", "latitud", "longitud", "descripcion" },
  "imagenes": [{ "id", "orden", "capturadaEn", "latitud", "longitud", "url" }],
  "inspeccion": { "verdictFraude", "indicadoresFraude": [], "nivelSeveridad",
                  "costoTotalEstimado", "confianzaGlobal", "modeloIa", "versionPrompt" },
  "evaluaciones": [{ "codigoPieza", "accionRequerida", "horasManoObra",
                     "costoPiezaEstimado", "confianza", "bbox" }]
}
```
