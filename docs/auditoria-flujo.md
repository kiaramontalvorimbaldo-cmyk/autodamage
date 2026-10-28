# Auditoría del flujo — Sprint 3.6 (Paso 0)

Tabla `elemento | existe (✔/✘/parcial) | ruta del archivo` para los elementos de la sección 3 de CORRECCION2.md.

## Perito

| Elemento                              | Estado  | Ruta del archivo                                   | Detalle                                                                                                                                                                                                         |
| ------------------------------------- | ------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bandeja `/perito`                     | parcial | `src/app/(perito)/perito/page.tsx`                 | Existe bandeja básica con filtros, pero falta orden por antigüedad ascendente en pendientes, tarjetas con asegurado y vehículo formateados según especificación.                                                |
| Detalle `/perito/siniestros/[id]`     | parcial | `src/app/(perito)/perito/siniestros/[id]/page.tsx` | Falta navegación con migas de pan y botón "Volver a la bandeja", datos del vehículo/asegurado, razones del triaje visibles, pestaña Historial en pestañas y modo solo lectura si no es EN_REVISION o rol ADMIN. |
| `DamageViewer`                        | parcial | `src/components/perito/DamageViewer.tsx`           | Escala 0–1000 a SVG correctamente, pero no implementa carrusel para navegar entre múltiples fotos con sus respectivas cajas.                                                                                    |
| Tabla de piezas editable              | parcial | `src/components/perito/PartsTable.tsx`             | Permite editar acción, costo y observación, pero falta soporte para modo solo lectura cuando el caso no está en EN_REVISION.                                                                                    |
| Formulario de dictamen                | parcial | `src/components/perito/VerdictForm.tsx`            | Solo obligaba observaciones en rechazo (no en ampliación) y no deshabilitaba el botón de envío con mensaje de ayuda si faltan campos obligatorios.                                                              |
| `POST /api/siniestros/:id/dictamen`   | parcial | `src/app/api/siniestros/[id]/dictamen/route.ts`    | Caso de uso `issueVerdict` no exigía observaciones en ampliación, no restringía rol no-PERITO a nivel de caso de uso (403), y el recálculo no filtraba piezas desaprobadas (`aprobado_por_perito = true`).      |
| `POST /api/siniestros/:id/reanalizar` | ✔       | `src/app/api/siniestros/[id]/reanalizar/route.ts`  | Crea nueva inspección DIGITAL_IA conservando el histórico e inicia el proceso asíncrono.                                                                                                                        |

## Taller

| Elemento                        | Estado | Ruta del archivo                                                                                                                            | Detalle                                                                   |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/taller/ordenes`               | ✔      | `src/app/(taller)/taller/ordenes/page.tsx`                                                                                                  | Lista órdenes con filtros por estado y empty state.                       |
| Detalle `/taller/ordenes/[id]`  | ✔      | `src/app/(taller)/taller/ordenes/[id]/page.tsx`                                                                                             | Detalle con datos de vehículo, piezas y botón de siguiente paso.          |
| `GET /api/ordenes`              | ✔      | `src/app/api/ordenes/route.ts`                                                                                                              | Taller ve las suyas, perito/admin ven todas.                              |
| `PATCH /api/ordenes/:id/estado` | ✔      | `src/app/api/ordenes/[id]/estado/route.ts`                                                                                                  | Avanza estado y al completar finaliza el siniestro.                       |
| Casos de uso taller             | ✔      | `src/application/use-cases/issue-work-order.ts`, `src/domain/workshop/assign-workshop.ts`, `src/application/use-cases/update-work-order.ts` | Lógica de emisión, asignación determinista y actualización implementadas. |

## Admin

| Elemento            | Estado | Ruta del archivo                                                       | Detalle                                                         |
| ------------------- | ------ | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| Portal `/admin`     | ✘      | `src/app/(admin)/admin/...`                                            | No existe aún (alcance de Parte C).                             |
| Gestión de personal | ✘      | `src/app/(admin)/admin/personal/...`, `src/app/api/admin/personal/...` | No existe aún (alcance de Parte C).                             |
| Auditoría global    | ✔      | `src/app/api/siniestros/[id]/auditoria/route.ts`                       | Endpoint de auditoría por siniestro existe para PERITO y ADMIN. |

## Asegurado

| Elemento                                    | Estado | Ruta del archivo                                         | Detalle                                                             |
| ------------------------------------------- | ------ | -------------------------------------------------------- | ------------------------------------------------------------------- |
| Seguimiento en `/asegurado/siniestros/[id]` | ✔      | `src/app/(asegurado)/asegurado/siniestros/[id]/page.tsx` | Línea de tiempo visual y detalle del siniestro con taller asignado. |

## Transversal

| Elemento                             | Estado  | Ruta del archivo                                                                    | Detalle                                                                                                             |
| ------------------------------------ | ------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Redirección por rol en middleware    | ✔       | `src/middleware.ts`                                                                 | Redirige por rol (ADMIN temporalmente a /perito hasta Parte C). Falta test unitario específico del middleware.      |
| `scripts/seed-dev-users.ts`          | ✔       | `scripts/seed-dev-users.ts`                                                         | Crea perito, 2 talleres y admin.                                                                                    |
| `PortalShell` y `EmptyState`         | ✔       | `src/components/layout/portal-shell.tsx`, `src/components/ui-extra/empty-state.tsx` | Shell con navegación por rol y componente de estado vacío.                                                          |
| `lib/user-messages.ts`               | ✔       | `src/lib/user-messages.ts`                                                          | Mapeo de errores técnicos a mensajes amigables.                                                                     |
| `scripts/seed-demo.ts` + `seed:demo` | parcial | `scripts/seed-demo.ts`, `package.json`                                              | Existe script pero calcula costos y triaje con lógica interna en lugar de importar las funciones puras del dominio. |
| `MOCK_AI_SCENARIO` en MockProvider   | parcial | `src/infrastructure/ai/mock-provider.ts`                                            | Admite escenarios por constructor pero no toma `process.env.MOCK_AI_SCENARIO` por defecto.                          |
