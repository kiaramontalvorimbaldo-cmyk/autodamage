# SPRINT 3.6 — Flujo completo de la aseguradora (perito, taller, administrador)

> Documento autocontenido. **Lee solo este archivo.** Completa un proyecto **ya iniciado**: primero audita lo que existe y luego construye únicamente lo que falte. No reescribas lo que ya funciona.

## 0. Cómo trabajar

1. El usuario indicará **Parte A**, **B** o **C**. Si no indica, haz la **Parte A**. Cada parte termina con el sistema usable.
2. **Paso 0 obligatorio (auditoría).** Sin imprimir archivos completos, revisa el código y crea `docs/auditoria-flujo.md` con una tabla `elemento | existe (✔/✘/parcial) | ruta del archivo`, para los elementos de la sección 3. Construye solo lo ✘ o parcial. Si la estructura real difiere de la descrita, adáptate a la real.
3. Ahorra tokens: no reimprimas archivos sin cambios; entrega solo el reporte de la sección 9.
4. **No tocar:** motor de triaje, IA, reglas de fraude, lógica interna de captura de fotos ni migraciones existentes (si falta una tabla o columna, crea una migración **nueva**).
5. Si algo te bloquea, haz como máximo **una** pregunta.

## 1. Contexto técnico

- **Stack:** Next.js (App Router) + TypeScript estricto + Tailwind + shadcn/ui + Zod + Supabase (Postgres con RLS, Auth con `@supabase/ssr`, Storage privado `evidencias`). Se ejecuta **en local** contra Supabase remoto.
- **Capas:** `app/` (páginas y Route Handlers) → `application/` (casos de uso) → `domain/` (funciones puras) ; `infrastructure/` implementa los puertos. Errores de API: `{error:{code,message}}`. Las escrituras del sistema usan el cliente `admin` (service role), solo en servidor.
- **Roles:** `ASEGURADO`, `PERITO`, `TALLER`, `ADMIN`. El login redirige por rol: `/asegurado`, `/perito`, `/taller`, `/admin`. El registro público crea solo asegurados; el personal se crea desde el portal de administrador.
- **Tablas:**
  - `usuarios(id, nombre_completo, email, rol)` · `peritos(id, usuario_id, numero_licencia, estado: ACTIVO|OCUPADO|INACTIVO)` · `talleres(id, usuario_id, nombre, direccion, telefono, activo)`
  - `vehiculos(id, asegurado_id, matricula, marca, modelo, numero_poliza)`
  - `siniestros(id, asegurado_id, vehiculo_id, fecha_registro, fecha_incidente, latitud, longitud, descripcion, estado, ruta, analisis_estado, requiere_inspeccion_presencial, etiquetas[])`
  - `imagenes_siniestro(id, siniestro_id, storage_path, capturada_en, latitud, longitud, orden)`
  - `inspecciones_periciales(id, siniestro_id, perito_id, tipo_inspeccion, dictamen_final, observaciones_perito, verdict_fraude, indicadores_fraude[], nivel_severidad, costo_total_estimado, confianza_global, respuesta_ia)`
  - `evaluacion_detallada_danos(id, inspeccion_id, codigo_pieza, accion_requerida, horas_mano_obra, costo_pieza_estimado, confianza, imagen_id, bbox, aprobado_por_perito, observacion_pieza)`
  - `baremo_mock(codigo_pieza, pieza_nombre, costo_repuesto_base, horas_mano_obra, costo_hora_mo=30)`
  - `ordenes_trabajo(id, siniestro_id UNIQUE, taller_id, estado, monto_autorizado, creado_en, actualizado_en)` · `audit_log(entidad, entidad_id, accion, actor_tipo USUARIO|SISTEMA|IA, actor_id, datos, creado_en)` (inmutable)
- **`bbox`:** `[ymin, xmin, ymax, xmax]` normalizado 0–1000, relativo a la imagen indicada en `imagen_id`.

## 2. El flujo que debe quedar funcionando

```
ASEGURADO reporta → SISTEMA analiza (IA + fraude + costo + triaje)
  🟢 VERDE    → estado FAST_TRACK → orden EMITIDA automática → TALLER
  🟡 AMARILLA → estado EN_REVISION → bandeja del PERITO
  🔴 ROJA     → estado EN_REVISION + inspección presencial → bandeja del PERITO
PERITO dictamina:
  APROBAR → estado APROBADO → orden EMITIDA → TALLER
  AMPLIACIÓN → sigue EN_REVISION (pide más información; el asegurado lo ve)
  RECHAZAR (obligatorio con observaciones) → RECHAZADO   ← única vía a RECHAZADO
TALLER: EMITIDA → RECIBIDO → EN_REPARACION → COMPLETADO → siniestro FINALIZADO
ADMIN: consulta casos, revisa auditoría y gestiona el personal
```

**Reglas del dominio (si ya existen en `domain/`, reutilízalas; no las dupliques):**

- Estados del siniestro: `PENDIENTE → FAST_TRACK | EN_REVISION`; `EN_REVISION → APROBADO | RECHAZADO | EN_REVISION`; `FAST_TRACK | APROBADO → FINALIZADO`. El sistema nunca escribe `RECHAZADO`; solo un `PERITO` con dictamen `RECHAZADO`.
- Estados de la orden: avanzan un paso a la vez y no retroceden. Solo el taller dueño puede cambiarlos. Al completar, el siniestro pasa a `FINALIZADO`.
- Costo de pieza: `SUSTITUIR = repuesto + horas×costo_hora`; `REPARAR = horas×costo_hora`; `PINTAR = horas×0.6×costo_hora`. Total del caso = suma de piezas con `aprobado_por_perito = true`. Redondeo a 2 decimales.
- **Asignación de taller:** entre talleres `activo = true`, el de menos órdenes abiertas (`EMITIDA`, `RECIBIDO`, `EN_REPARACION`); empate → quien tenga la orden abierta más antigua, o menor `id`. Sin talleres activos → error `SIN_TALLERES_DISPONIBLES` y el caso queda `EN_REVISION`.
- **Orden idempotente:** nunca se crea más de una orden por siniestro.
- Toda decisión (IA, sistema, perito, taller, admin) escribe en `audit_log` con actor, momento y valores anterior/nuevo.

## 3. Elementos a auditar (Paso 0)

Perito: ruta `/perito` con bandeja · detalle `/perito/siniestros/[id]` · `DamageViewer` · tabla de piezas editable · formulario de dictamen · `POST /api/siniestros/:id/dictamen` · `POST /api/siniestros/:id/reanalizar`.
Taller: `/taller/ordenes` · detalle · `GET /api/ordenes` · `PATCH /api/ordenes/:id/estado` · casos de uso `issueWorkOrder`/`assignWorkshop`/`updateWorkOrder`.
Admin: portal `/admin` · gestión de personal · auditoría `GET /api/siniestros/:id/auditoria`.
Asegurado: seguimiento del estado/dictamen/orden en `/asegurado/siniestros/[id]`.
Transversal: redirección por rol en el middleware · `scripts/seed-dev-users.ts` (perito, 2 talleres, admin) · `PortalShell` y `EmptyState`.

## 4. Reglas UX (obligatorias en todas las pantallas)

1. Cada endpoint tiene un control visible en la UI. 2. Los textos al usuario no mencionan "API", "BD", "endpoint" ni "Supabase". 3. Toda pantalla tiene salida (Volver/Cancelar/migas). 4. Un estado vacío explica y ofrece acción (no es un error rojo). 5. Toda acción asíncrona muestra spinner y deshabilita el botón. 6. Navegación persistente por rol: usa `PortalShell` si existe; si no, créalo mínimo (lateral en escritorio, inferior en móvil, enlace activo con `aria-current`). 7. Un botón deshabilitado explica por qué. 8. Los errores se traducen con `lib/user-messages.ts` (créalo si no existe). 9. Datos en servidor y `loading.tsx` por grupo de rutas; consultas independientes en `Promise.all`.

---

# PARTE A — Datos de demostración y portal del perito

### A1. Datos de demostración `[BE]`

- `scripts/seed-demo.ts` + script npm `seed:demo` (idempotente; marca los datos con `[DEMO]` en `descripcion`; flag `--reset` para recrearlos). Al terminar imprime las **cuentas de prueba** (correo y contraseña) de asegurado, perito, taller y admin. Reutiliza `seed-dev-users` si ya crea al personal.
- Crea para un asegurado demo con 1 vehículo, **3 siniestros** con imágenes de relleno (genera 1280×960 con `sharp` a partir de un SVG con el texto "Foto demo N" y súbelas a Storage), inspección, piezas con `bbox` y auditoría coherentes:
  1. 🟢 VERDE: faro delantero izquierdo `SUSTITUIR` (150.00 USD), estado `FAST_TRACK`, orden `EMITIDA` asignada a un taller.
  2. 🟡 AMARILLA: puerta delantera derecha `REPARAR` + espejo derecho `SUSTITUIR`, severidad MODERADO, `EN_REVISION`.
  3. 🔴 ROJA: severidad SEVERO con `dano_estructural`, `requiere_inspeccion_presencial = true`, `EN_REVISION`.
- Calcula costos y rutas **con las funciones del dominio**, no con valores escritos a mano.
- Añade `MOCK_AI_SCENARIO` (`leve-faro|moderado-puerta|severo-estructural|recaptura|baja-confianza|sin-piezas`) al `MockProvider` si no existe, para que un reporte real desde la interfaz (`AI_PROVIDER=mock`) produzca la ruta deseada.

### A2. Bandeja del perito `[FE][BE]`

- `GET /api/siniestros?ruta=&estado=&page=&pageSize=` (si ya existe, verifica que PERITO y ADMIN ven todos y que el asegurado solo ve los suyos).
- `/perito`: pestañas **Pendientes** (`EN_REVISION`) y **Resueltos** (`APROBADO`, `RECHAZADO`, `FINALIZADO`, `FAST_TRACK`). Tarjetas o tabla con: código corto, asegurado, vehículo, `RouteBadge`, estado, etiquetas (`IA_NO_DISPONIBLE`, `BAJA_CONFIANZA`…), antigüedad. Filtros por ruta, orden de más antiguo primero en pendientes, paginación de 20. Estado vacío: "No hay casos pendientes".

### A3. Detalle y dictamen `[FE][BE]`

- `/perito/siniestros/[id]` con migas de pan y "Volver a la bandeja":
  - Datos del caso (asegurado, vehículo, fecha, descripción).
  - `DamageViewer`: carrusel de imágenes con cajas SVG superpuestas (convierte coordenadas 0–1000 al tamaño mostrado; etiqueta con nombre de pieza y confianza).
  - Resumen del análisis: severidad, confianza, **razones del triaje**, veredicto de fraude e indicadores, etiquetas.
  - Tabla de piezas **editable**: acción (select), costo (input), "aprobada" (check), observación; el total se recalcula al instante.
  - Mapa Leaflet (carga dinámica `ssr:false`) con la ubicación declarada y la de las fotos.
  - **Formulario de dictamen:** Aprobar / Solicitar ampliación / Rechazar. Observaciones obligatorias en rechazo y ampliación. Botón deshabilitado con ayuda si falta algo.
  - Botón "Reintentar análisis" solo si hay etiqueta `IA_NO_DISPONIBLE` o `analisis_estado = FALLIDO`.
  - Solo lectura si el caso no está `EN_REVISION` o el usuario es `ADMIN`.
- `POST /api/siniestros/:id/dictamen` (solo PERITO), body Zod: `{dictamen_final, observaciones_perito, kilometraje?, ajustes?: [{evaluacion_id, accion_requerida?, costo_pieza_estimado?, aprobado_por_perito, observacion_pieza?}]}`. Caso de uso `issueVerdict`: valida estado `EN_REVISION`, aplica ajustes, recalcula `costo_total_estimado`, guarda el dictamen, mueve el estado con la máquina de estados, audita. Si es `APROBADO`, llama a `issueWorkOrder` (Parte B; si aún no existe, deja el estado `APROBADO` y registra la orden como pendiente de la Parte B).
- `POST /api/siniestros/:id/reanalizar` (solo PERITO): nueva inspección `DIGITAL_IA`, conserva las anteriores.
- `GET /api/siniestros/:id/auditoria` (PERITO, ADMIN) y pestaña **Historial** en el detalle (línea de tiempo con actor, acción y hora).

### Pruebas unitarias (Parte A)

`issue-verdict` (aprobar, ajustar costos, rechazar con y sin observaciones, ampliación; no dictaminar fuera de `EN_REVISION`; ASEGURADO/TALLER → 403; auditoría escrita; imposible `RECHAZADO` sin PERITO) · `list-claims` (alcance por rol, filtros, paginación) · `DamageViewer` (conversión 0–1000 → píxeles) · `PartsTable` (recálculo del total) · `VerdictForm` (validación) · middleware (PERITO a `/perito`, ASEGURADO bloqueado en `/perito`) · `seed-demo` (las 3 rutas coinciden con el motor de triaje).

### Criterios de aceptación (Parte A)

- [ ] `npm run seed:demo` imprime las cuentas y deja 3 casos visibles.
- [ ] Entrando como perito se ve la bandeja con los casos amarillo y rojo en Pendientes.
- [ ] El perito abre un caso, ve las imágenes con cajas, ajusta una pieza y aprueba: el estado pasa a `APROBADO` y queda en el historial.
- [ ] Rechazar sin observaciones no es posible; con observaciones deja `RECHAZADO`.

---

# PARTE B — Órdenes de trabajo, portal del taller y seguimiento del asegurado

### B1. Órdenes `[BE]`

- Casos de uso `assignWorkshop` (pura, en `domain/workshop`), `issueWorkOrder` (idempotente), `updateWorkOrder`; transiciones en `domain/claim-state/work-order-state.ts`.
- `issueWorkOrder` se ejecuta (a) al terminar el análisis con ruta VERDE y (b) al aprobar el perito. `monto_autorizado = costo_total_estimado`. Sin talleres activos → `SIN_TALLERES_DISPONIBLES`, el caso queda `EN_REVISION` y se audita.
- `GET /api/ordenes?estado=` (TALLER: las suyas; PERITO/ADMIN: todas) y `PATCH /api/ordenes/:id/estado` `{estado}` (solo el taller dueño; valida la transición; al completar → siniestro `FINALIZADO`).

### B2. Portal del taller `[FE]`

- `/taller/ordenes`: lista con filtros por estado y estado vacío "No tienes órdenes asignadas".
- `/taller/ordenes/[id]`: migas y "Volver"; datos del vehículo, piezas aprobadas con acción, monto autorizado, imágenes (URL firmada); botón único del **siguiente paso** ("Marcar como recibido", "Iniciar reparación", "Marcar como completado") con diálogo de confirmación; si está completada, solo lectura.

### B3. Seguimiento del asegurado `[FE]`

- En `/asegurado/siniestros/[id]`: **línea de tiempo** Reportado → Analizado → Revisión del perito (si aplica) → Aprobado → En reparación → Finalizado, con el paso actual resaltado y un texto claro del siguiente paso según la ruta. Si el dictamen es ampliación o rechazo, mostrar las observaciones del perito en lenguaje claro. Con orden activa, mostrar el nombre y la dirección del taller.

### Pruebas unitarias (Parte B)

`assign-workshop` (menor carga, empate, sin órdenes, inactivos, sin talleres) · `work-order-state` (transiciones válidas e inválidas) · `issue-work-order` (VERDE y aprobación, **idempotencia**, auditoría, sin talleres) · `update-work-order` (solo el taller dueño, completar → `FINALIZADO`, otros roles 403) · `ClaimTimeline` (cada estado marca el paso correcto).
**E2E Playwright** (`AI_PROVIDER=mock`, tres sesiones): (1) asegurado reporta caso `moderado-puerta` → perito lo ve y aprueba → taller recibe, repara y completa → asegurado ve "Finalizado"; (2) caso `leve-faro` genera orden automática sin perito; (3) caso `severo-estructural` → perito rechaza con observaciones → asegurado las ve.

### Criterios de aceptación (Parte B)

- [ ] El caso VERDE aparece como orden en el taller sin intervención del perito.
- [ ] Un caso aprobado por el perito genera exactamente una orden.
- [ ] Un taller solo ve y modifica sus propias órdenes.
- [ ] El asegurado ve en su pantalla cada cambio de estado.

---

# PARTE C — Portal del administrador y gestión del personal

### C1. Gestión de personal `[BE][FE]`

- `/admin/personal`: lista de peritos y talleres con estado y botón **Desactivar/Activar**; botón **Crear perito** y **Crear taller** (diálogo con formulario Zod: perito → nombre, correo, número de licencia; taller → nombre del taller, responsable, correo, dirección, teléfono).
- `POST /api/admin/personal` (solo ADMIN, verificado en servidor): con el cliente `admin` crea el usuario de Auth con contraseña temporal generada (`email_confirm: true`), **actualiza `usuarios.rol`** (el trigger de alta lo crea como `ASEGURADO`) e inserta la fila en `peritos` o `talleres`. Si algún paso falla, **revierte** eliminando el usuario de Auth. Devuelve la contraseña temporal **una sola vez** y la UI la muestra con botón "Copiar".
- `PATCH /api/admin/personal/:id` `{activo}`: perito → `estado = INACTIVO|ACTIVO`; taller → `activo`; al desactivar, bloquear el acceso (`ban_duration`) y no asignarle nuevas órdenes.
- Correo duplicado → mensaje claro ("Ya existe un usuario con ese correo").

### C2. Portal del administrador `[FE]`

- `/admin`: tarjetas de resumen (casos por ruta, por estado, órdenes abiertas) y accesos a Casos, Personal y Auditoría.
- `/admin/casos`: reutiliza la bandeja del perito en **solo lectura**.
- `/admin/auditoria`: lista paginada del `audit_log` con filtros por entidad y acción (solo lectura).
- Actualizar la redirección por rol: `ADMIN → /admin`.

### Pruebas unitarias (Parte C)

Caso de uso de alta de personal (crea rol y fila correctos; **revierte** si falla un paso; correo duplicado; usuario no ADMIN → 403) · desactivar taller → no recibe órdenes nuevas · el formulario de alta valida campos · `/admin` inaccesible para otros roles (middleware) · `audit_log` rechaza UPDATE/DELETE (prueba de integración contra `dev`).

### Criterios de aceptación (Parte C)

- [ ] El administrador crea un perito y un taller desde la interfaz y estos pueden iniciar sesión y llegar a su portal.
- [ ] Un taller desactivado no recibe órdenes ni puede ingresar.
- [ ] El administrador consulta casos y auditoría sin poder modificarlos.

---

## 8. Comandos de verificación (cada parte)

```bash
npm run lint && npm run typecheck && npm run test:coverage && npm run build
npm run seed:demo          # Parte A en adelante
AI_PROVIDER=mock npm run test:e2e
```

Cobertura de `src/domain/` ≥ 90 %. Verifica a mano en el navegador con las cuentas que imprime `seed:demo`.

## 9. Reporte final (breve)

1. Tabla de auditoría (qué existía y qué se construyó). 2. Árbol de archivos nuevos/modificados. 3. Resultado de cada comando. 4. Checklist de criterios ✔/✘. 5. **Cuentas de prueba** (correo y contraseña por rol). 6. Limitaciones conocidas. 7. Mensaje de commit sugerido.

## 10. Fuera de alcance

Motor de triaje, IA, fraude, captura de fotos, PDF, notificaciones por correo, pagos, integración con sistemas externos y optimización de rendimiento (eso es la Parte 2 del Sprint 3.5).
