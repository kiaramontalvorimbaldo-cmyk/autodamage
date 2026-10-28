# SPRINT 3.5 — Corrección de UX y rendimiento (AutoDamage AI)

> Documento autocontenido. **Lee solo este archivo**; no es necesario releer `AGENTS.md`. Corrige un proyecto **ya construido**: modifica el código existente, no lo reescribas.

## 0. Cómo trabajar

1. El usuario dirá qué parte ejecutar: **Parte 1** (flujo y navegación) o **Parte 2** (rendimiento). Si no dice, haz la Parte 1.
2. **Audita antes de cambiar** (sin imprimir archivos completos): `ls`/`find` de `src/app`, `src/components`, `src/lib`; `grep` de rutas y componentes existentes. Si la estructura real difiere de este documento, adáptate a la real y no crees duplicados.
3. Ahorra tokens: no reimprimas archivos sin cambios, no expliques de más; entrega solo el árbol de archivos nuevos/modificados y el reporte final (sección 8).
4. **No tocar:** `src/domain/`, la integración con IA, la lógica interna de captura/difuminado/envío de fotos, migraciones existentes. Solo se envuelven con navegación y estados.
5. No crear pantallas de PERITO o TALLER que aún no existan; sí aplicarles el `PortalShell` si ya existen.
6. Si algo bloquea, haz como máximo **una** pregunta.

## 1. Contexto técnico (resumen de lo ya construido)

- **Stack:** Next.js (App Router) + TypeScript estricto + Tailwind + shadcn/ui + Zod + Supabase (Postgres, Auth con `@supabase/ssr`, Storage). Se ejecuta **en local** (`npm run dev`) contra Supabase remoto.
- **Capas:** `app/` → `application/` (casos de uso) → `domain/` (puro) ; `infrastructure/` implementa puertos. Route Handlers validan con Zod y devuelven errores `{error:{code,message}}`.
- **Tablas relevantes:** `usuarios(id, nombre_completo, email, rol)`, `vehiculos(id, asegurado_id, matricula UNIQUE, marca, modelo, numero_poliza UNIQUE)`, `siniestros(id, asegurado_id, vehiculo_id, estado, ruta, analisis_estado, fecha_registro, ...)`. RLS activo: el asegurado solo ve y modifica lo suyo.
- **API existente:** `POST/GET /api/vehiculos`, `POST/GET /api/siniestros`, `GET /api/siniestros/:id`, imágenes y `analizar`.
- **Componentes existentes (verificar):** `RouteBadge`, `ClaimCard`, `LoadingState`, `ErrorState`, `lib/api-client.ts`.

## 2. Reglas UX y rendimiento (obligatorias)

1. Cada endpoint de la API debe tener un control visible en la UI.
2. Un usuario nuevo, sin datos, debe completar el flujo principal solo con la interfaz. Los textos al usuario **nunca** mencionan "API", "BD", "endpoint", "Supabase" ni códigos técnicos.
3. Toda pantalla tiene salida (Volver, Cancelar o migas de pan) y todo asistente tiene "Atrás".
4. Un estado vacío explica qué falta y ofrece el botón que lo resuelve. **No es un error** (no se pinta en rojo).
5. Toda acción asíncrona muestra spinner y deshabilita el botón ("Guardando…"). Nada tarda más de 1 s sin indicador.
6. Layout con navegación persistente por rol.
7. Un botón deshabilitado siempre explica por qué (texto de ayuda visible).
8. Accesibilidad básica: `aria-current` en el enlace activo, etiquetas en formularios, foco visible, no depender solo del color.

---

# PARTE 1 — Flujo, navegación y pantallas faltantes

## 3. Matriz capacidad → pantalla → botón

| Capacidad (API)   | Pantalla                                                    | Control visible             |
| ----------------- | ----------------------------------------------------------- | --------------------------- |
| Listar vehículos  | `/asegurado/vehiculos`                                      | Tarjetas de vehículos       |
| Crear vehículo    | `/asegurado/vehiculos/nuevo` y diálogo dentro del asistente | "Registrar vehículo"        |
| Editar vehículo   | `/asegurado/vehiculos/[id]/editar`                          | "Editar" en cada tarjeta    |
| Eliminar vehículo | Lista de vehículos                                          | "Eliminar" con confirmación |
| Crear siniestro   | `/asegurado/nuevo-siniestro`                                | Asistente de 4 pasos        |
| Listar siniestros | `/asegurado/siniestros`                                     | Lista con `ClaimCard`       |
| Ver siniestro     | `/asegurado/siniestros/[id]`                                | Clic en la tarjeta          |

## 4. Tareas

### Bloque A — Layout y navegación `[FE]`

- Crear `src/components/layout/portal-shell.tsx` y usarlo en el layout de cada portal existente.
  - **Escritorio (≥ md):** barra lateral con logo (enlace a la página de inicio del rol), ítems y botón "Cerrar sesión".
  - **Móvil:** barra superior con logo y barra inferior fija con los ítems principales (con ícono y texto).
  - Ítems del **Asegurado**: Inicio, Reportar siniestro, Mis siniestros, Mis vehículos. Enlace activo resaltado con `aria-current="page"`.
  - Cabecera con nombre capitalizado y rol legible.
- Crear `components/layout/breadcrumbs.tsx` y `components/layout/back-button.tsx` (usa `router.back()` con una ruta de respaldo si no hay historial).
- Utilidades en `src/lib/format.ts`: `formatName("kiara montalvo") → "Kiara Montalvo"` y `rolLabel("ASEGURADO") → "Asegurado"` (ASEGURADO/PERITO/TALLER/ADMIN → Asegurado/Perito/Taller/Administrador).
- Crear `components/ui-extra/empty-state.tsx` (ícono, título, descripción, acción opcional) y reutilizar `LoadingState`.

### Bloque B — Gestión de vehículos `[BE][FE]`

- **[BE]** Verificar y completar `src/app/api/vehiculos/[id]/route.ts` con `PATCH` (editar) y `DELETE`; solo el dueño (RLS + comprobación en el caso de uso). Reglas:
  - Matrícula normalizada a mayúsculas y sin espacios sobrantes.
  - Duplicado de matrícula o póliza → `409` con código `VEHICULO_DUPLICADO` y mensaje claro del campo afectado.
  - Eliminar un vehículo con siniestros → `409 VEHICULO_CON_SINIESTROS`.
- **[FE]** `components/vehicle/vehicle-form.tsx` (React Hook Form + Zod: matrícula, marca, modelo, número de póliza; mensajes de error por campo en español) y `components/vehicle/vehicle-dialog.tsx` (el mismo formulario dentro de un diálogo shadcn, reutilizable).
- **[FE]** Páginas: lista `/asegurado/vehiculos` (tarjetas con Editar y Eliminar, confirmación antes de eliminar, estado vacío con botón "Registrar vehículo"), `/nuevo` y `/[id]/editar` (con "Cancelar" y "Volver").
- **[FE]** Notificaciones con `sonner` (shadcn) para éxito y error.

### Bloque C — Asistente "Nuevo siniestro" `[FE]`

Envolver el asistente existente sin cambiar su lógica de captura/envío:

- **Stepper visual** de 4 pasos con nombre (Vehículo, Detalles, Fotos, Revisar), paso actual resaltado y pasos completados marcados.
- Botones: **Atrás**, **Siguiente**, **Cancelar**. Cancelar con datos ingresados pide confirmación.
- **Paso 1:** vehículos como tarjetas seleccionables + botón "Registrar otro vehículo" (abre `VehicleDialog`; al guardar, el vehículo queda seleccionado). Sin vehículos: `EmptyState` "Aún no tienes vehículos" con el botón "Registrar mi primer vehículo". **Reemplaza** el mensaje actual "Registra uno primero con la API".
- "Siguiente" deshabilitado muestra la ayuda: "Selecciona un vehículo para continuar" (o la que corresponda por paso).
- Conservar el borrador entre pasos al volver atrás (estado del asistente; las fotos no se persisten).
- Si el envío falla, mostrar mensaje amigable y permitir reintentar sin perder datos.

### Bloque D — Inicio y listados `[FE]`

- **Inicio del asegurado:** saludo con `formatName`; tarjetas de resumen (n.º de vehículos, siniestros activos, último siniestro con `RouteBadge`); botones principales "Reportar siniestro" y "Mis siniestros". Si no tiene vehículos, mostrar una tarjeta de guía con 2 pasos: "1. Registra tu vehículo → 2. Reporta tu siniestro", con el botón del paso 1.
- **Mis siniestros:** lista de `ClaimCard` (ruta, estado, fecha, vehículo); estado vacío "Aún no has reportado siniestros" con botón "Reportar siniestro"; filtros simples por estado si ya existe soporte.

### Bloque E — Mensajes al usuario `[FE][BE]`

- Crear `src/lib/user-messages.ts`: mapea códigos de error (`VEHICULO_DUPLICADO`, `VEHICULO_CON_SINIESTROS`, `NO_AUTORIZADO`, `ARCHIVO_NO_EN_VIVO`, `IA_NO_DISPONIBLE`, errores de red, etc.) a textos en español, sin jerga. Todo componente usa este mapa; ningún texto de error se escribe directamente en los componentes.
- Buscar con `grep -rniE "api|endpoint|supabase|bd" src/app src/components` los textos visibles al usuario y reemplazarlos.

## 5. Pruebas unitarias requeridas (Parte 1)

- `format.test.ts`: `formatName` (mayúsculas, espacios dobles, vacío) y `rolLabel`.
- `user-messages.test.ts`: cada código conocido devuelve texto en español; código desconocido devuelve el mensaje genérico; ningún texto contiene "API", "endpoint" ni "Supabase".
- `vehicle-form.test.tsx`: campos obligatorios, matrícula en mayúsculas, mensajes por campo.
- `empty-state.test.tsx`: renderiza título, descripción y la acción.
- `portal-shell.test.tsx`: ítems correctos por rol y `aria-current` en la ruta activa.
- `new-claim-wizard.test.tsx`: no avanza sin vehículo seleccionado y muestra la ayuda; Atrás conserva los datos; Cancelar con datos pide confirmación.
- `vehicles-api` (casos de uso con repositorios en memoria): crear, editar, eliminar; `VEHICULO_DUPLICADO`; `VEHICULO_CON_SINIESTROS`; un asegurado no edita ni elimina vehículos ajenos.
- **E2E Playwright** (`AI_PROVIDER=mock`), usuario nuevo sin datos: registro → inicio muestra la guía → "Registrar vehículo" → aparece en el paso 1 del asistente → Atrás/Cancelar funcionan → "Mis vehículos" permite editar y eliminar.

## 6. Criterios de aceptación (Parte 1)

- [ ] Un usuario recién registrado puede crear un vehículo desde el inicio, desde "Mis vehículos" y desde el paso 1 del asistente.
- [ ] Ninguna pantalla es un callejón sin salida; el asistente tiene Atrás y Cancelar.
- [ ] Los estados vacíos ofrecen su acción y no se muestran en rojo.
- [ ] Hay menú persistente por rol (lateral en escritorio, inferior en móvil).
- [ ] Ningún texto visible menciona "API", "BD" o "endpoint".
- [ ] Todas las pruebas de la Parte 1 pasan y la cobertura de `domain/` no baja del 90 %.

---

# PARTE 2 — Rendimiento (local)

## 7. Tareas

> **Paso 0 (obligatorio): medir antes de tocar nada.** Crear `docs/rendimiento.md` con una tabla antes/después para 5 acciones: abrir inicio, abrir "Reportar siniestro", abrir "Mis vehículos", crear vehículo, abrir "Mis siniestros". Para cada una anotar: tiempo en `npm run dev` (la terminal de Next muestra `compile:` y `render:`), tiempo en `npm run build && npm start`, y nº de llamadas a `supabase.co` en la pestaña Network. **No dar por defecto lo que no se midió.**

### Bloque F — Autenticación sin viajes de red redundantes `[BE]`

- En `middleware.ts` (o `proxy.ts` según la versión de Next) usar `supabase.auth.getClaims()` en lugar de `getUser()` para validar la sesión (valida el JWT localmente si el proyecto usa claves de firma asimétricas; si Supabase devuelve error, mantener `getUser()` como respaldo y documentarlo).
- Crear `src/lib/auth/require-user.ts` con `requireUser()` envuelto en `React.cache()`: **una sola** verificación de sesión y **una sola** lectura del rol por petición. Todos los Route Handlers y Server Components lo reutilizan; eliminar llamadas repetidas a `getUser()` y consultas repetidas a `usuarios`.
- _Opcional, solo si tras medir el rol sigue siendo un cuello de botella:_ incluir el rol en el JWT con un Custom Access Token Hook de Supabase y leerlo de los claims.

### Bloque G — Carga de datos y feedback `[FE]`

- Pantallas de lectura (inicio, vehículos, siniestros): obtener los datos en **Server Components**, con consultas independientes en paralelo (`Promise.all`); eliminar cascadas `useEffect → fetch → useEffect`.
- Añadir `loading.tsx` en cada grupo de rutas (esqueletos, no solo un spinner).
- Botones de envío con `useTransition`/`useFormStatus`: estado "Guardando…" inmediato al pulsar.
- Mantener el prefetch por defecto de `next/link` en la navegación principal.

### Bloque H — Peso de las rutas `[FE]`

- Cargar con `dynamic(() => import(...), { ssr: false })` los módulos pesados **solo en las páginas que los usan**: MediaPipe (captura) y Leaflet (mapas). No deben entrar en las rutas de inicio, vehículos ni listados.
- Activar `experimental.optimizePackageImports` para librerías de íconos si aplica; si la versión de Next es anterior a la 16, ejecutar el desarrollo con Turbopack (`next dev --turbopack`).

### Bloque I — Servidor y BD `[BE]`

- Confirmar que `POST /api/siniestros/:id/analizar` responde `202` de inmediato y procesa con `after()`; registrar en consola la duración de cada Route Handler (`console.time`) durante la medición y retirar el registro al terminar.
- Si la medición muestra consultas de lectura > 200 ms: crear una migración **nueva** que cambie en las políticas RLS las llamadas `rol_actual()` y `auth.uid()` por `(select rol_actual())` y `(select auth.uid())` y verifique los índices de `siniestros(asegurado_id)` y `vehiculos(asegurado_id)`.

### Medidas manuales del usuario (el agente solo las recuerda en el reporte)

1. Mover el proyecto fuera de OneDrive y excluir la carpeta del proyecto en Windows Defender.
2. Evaluar la velocidad **siempre** con `npm run build && npm start`; en `npm run dev` la primera visita a cada ruta compila y es lenta por diseño.
3. Si cada llamada a Supabase tarda más de 150–200 ms, la región del proyecto está lejos: crear el proyecto en la región más cercana (en Sudamérica, São Paulo), aplicar las migraciones con `supabase db push`, ejecutar los scripts de seed y actualizar las variables de entorno.

## 8. Pruebas, criterios y entrega (Parte 2)

**Pruebas unitarias:** `require-user.test.ts` (con dobles: una sola verificación por petición aunque se invoque varias veces; rechaza sesión inválida; devuelve el rol); prueba del middleware para rutas públicas, protegidas y de rol incorrecto; prueba de que las pantallas de lectura no importan los módulos pesados de MediaPipe/Leaflet (análisis estático simple de imports).

**Criterios de aceptación:**

- [ ] `docs/rendimiento.md` completo con mediciones antes y después.
- [ ] En producción local, el cambio entre pantallas muestra respuesta visual en menos de 300 ms (esqueleto o contenido).
- [ ] Una navegación típica hace como máximo 1 verificación de sesión y 1 lectura de rol.
- [ ] Ningún botón queda sin indicador de carga durante más de 1 s.
- [ ] `analizar` responde en menos de 1 s.

**Comandos de verificación (ambas partes):**

```bash
npm run lint && npm run typecheck && npm run test:coverage && npm run build
AI_PROVIDER=mock npm run test:e2e
npm start      # medir manualmente tras el build
```

**Reporte final (breve):** (1) árbol de archivos nuevos/modificados, (2) resultado de cada comando, (3) checklist de criterios ✔/✘, (4) tabla antes/después de rendimiento (si se ejecutó la Parte 2), (5) pasos manuales pendientes del usuario, (6) mensaje de commit sugerido (`fix(ux): ...` / `perf: ...`).

## 9. Fuera de alcance

Cambios en el motor de triaje, la IA, las reglas de fraude, la captura de fotos, el dashboard del perito y el portal del taller (salvo aplicarles el `PortalShell`), y nuevas funcionalidades de negocio.
