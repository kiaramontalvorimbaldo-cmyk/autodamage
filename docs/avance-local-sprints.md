# Avance local de los sprints

Fecha: 21 de octubre de 2026.

Por indicación del usuario, se continúa sobre el código existente y se posponen las migraciones y el despliegue. Esta excepción permite desarrollar los siguientes sprints aunque el Sprint 1 no esté cerrado. No se considera cumplida una validación remota por pasar pruebas en memoria.

## Cambios de esta revisión

| Sprint | Cambio                                                                                       | Comprobación                                                   |
| ------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 2      | Coordenadas de IA limitadas a 0–1000 y cajas con área positiva                               | Siete casos nuevos del esquema                                 |
| 2      | Referencias de IA solo a imágenes enviadas; respuesta inválida reintenta una vez             | Prueba con HTTP interceptado por MSW, sin Gemini real          |
| 3      | Validación de todos los ajustes antes de la primera escritura; rechazo de duplicados         | Regresiones sin modificaciones ni auditoría ante entrada ajena |
| 3      | Preservación de precios manuales al cambiar solo aprobación; auditoría del costo sin ajustes | Regresiones de importes                                        |
| 4      | Validación del estado final del siniestro antes de completar la orden                        | Regresión que conserva EN_REPARACION ante estado incompatible  |
| 2–4    | Prueba integrada de casos de uso                                                             | Cuatro recorridos locales aprobados                            |

Los recorridos integrados cubren: alta de vehículo y siniestro, subida simulada, análisis verde, consulta con evidencia, orden y reparación terminada; degradación por cuota y reanálisis; ruta roja con aprobación humana; denegación de consulta y análisis al asegurado ajeno. Se corrigió el adaptador en memoria para devolver la inspección más reciente cuando las fechas coinciden. El historial no se borra.

Estas pruebas no usan HTTP de la aplicación, Supabase, cámara ni Gemini real. Los cambios previenen escrituras ante errores de validación, pero no convierten escrituras independientes en transacciones: fallos de infraestructura a mitad de un lote aún requieren una solución transaccional futura.

## Verificaciones

- ESLint: aprobado.
- TypeScript: aprobado.
- Batería completa con cobertura: aprobada; las tres pruebas que necesitan integración remota siguen omitidas.
- Módulo de IA: 42 pruebas aprobadas.
- Dictamen y actualización de órdenes: 19 pruebas aprobadas.
- Recorridos integrados locales: cuatro aprobados.

## Estado real de los sprints

- Sprint 1: pendiente aplicar 003/004, verificar RLS y usuarios reales, CI y despliegue.
- Sprint 2: backend existente revisado parcialmente; faltan recorrido HTTP completo, revisión de concurrencia y persistencia transaccional, llamada manual con Gemini real y fotos etiquetadas.
- Sprint 3: flujos y componentes existentes con pruebas locales; faltan validación de cámara y difuminado en teléfonos reales y comprobación conectada del dictamen.
- Sprint 4: ciclo de taller revisado parcialmente y recorrido local verde; faltan flujos E2E por navegador con sesiones de cada rol y aislamiento RLS remoto.
- Sprint 5: pendiente completar la revisión de seguridad, Lighthouse, rendimiento, set de fotos con métricas reales y documentación final de entrega. No se añaden mediciones inventadas ni se declara una versión final.

## Archivos modificados

src/infrastructure/ai/ai-schema.ts y su prueba; src/infrastructure/ai/gemini-provider.ts y su prueba; src/application/use-cases/issue-verdict.ts y su prueba; src/application/use-cases/update-work-order.ts y su prueba; src/infrastructure/repositories/in-memory-claim-repository.ts; tests/integration/flujo-local.test.ts; este documento.

Las migraciones, las claves privadas y el servicio remoto no se modificaron.

Compilación de producción: aprobada (código 0). Revisión de diferencias: aprobada.
