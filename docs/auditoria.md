# Auditoría del proyecto existente — 20/10/2026

Versión activa: C:/Users/HP/Downloads/ProyectoIntegrador3/autodamage-ai, repositorio kiaramontalvorimbaldo-cmyk/autodamage, commit inicial revisado 471f8a8. Esta versión es más avanzada que el arranque de outputs/autodamage-ai. No se reemplaza su implementación de negocio.

| Elemento                                        | Existe  | Ruta / hallazgo inicial                                                                                                                |
| ----------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Capas y ESLint                                  | parcial | src/domain, src/application, src/infrastructure; imports externos fuera de infraestructura                                             |
| Tablas, RLS y trigger alta                      | parcial | supabase/migrations/001–003; 11 tablas remotas y 20 piezas verificadas; privilegios de perfil demasiado amplios y políticas con ciclos |
| Endpoints                                       | ✔       | src/app/api/auth, vehiculos, siniestros, ordenes, admin/personal, health                                                               |
| PortalShell                                     | parcial | src/components/layout/portal-shell.tsx; ADMIN apuntaba a /perito                                                                       |
| EmptyState / Breadcrumbs / BackButton           | ✔       | src/components/ui-extra, src/components/layout                                                                                         |
| user-messages.ts                                | parcial | src/lib/user-messages.ts; autenticación tenía mensajes sueltos                                                                         |
| CRUD de vehículos API y UI                      | ✔       | src/app/api/vehiculos; src/app/(asegurado)/asegurado/vehiculos                                                                         |
| Asistente de cuatro pasos                       | ✔       | src/components/claim/new-claim-wizard.tsx                                                                                              |
| Bandeja y detalle del perito                    | ✔       | src/app/(perito)/perito                                                                                                                |
| issueVerdict / issueWorkOrder / updateWorkOrder | ✔       | src/application/use-cases                                                                                                              |
| assignWorkshop                                  | ✔       | src/domain/workshop/assign-workshop.ts                                                                                                 |
| Portal taller                                   | ✔       | src/app/(taller)/taller                                                                                                                |
| Portal admin y personal                         | parcial | API existente; faltaba ruta /admin y su navegación                                                                                     |
| seed-dev-users / seed-demo                      | parcial | scripts/; seed-dev-users sin rollback en algunos fallos                                                                                |
| Redirección por rol                             | parcial | src/middleware.ts; ADMIN se enviaba a /perito                                                                                          |
| loading.tsx                                     | ✘       | no se encontraron esqueletos por grupo                                                                                                 |
| requireUser con cache por petición              | ✘       | sesiones y perfiles se resolvían por caminos separados                                                                                 |

## Evidencia remota de solo lectura

La configuración de Supabase responde. Conteos: usuarios 8, vehículos 3, peritos 2, talleres 2, baremo 20, siniestros 3, imágenes 3, inspecciones 3, piezas evaluadas 4, órdenes 1, auditoría 3. Los conteos no acreditan RLS ni historial de migraciones aplicado.

## Alcance autorizado

El usuario pidió después «Por ahora solo verificar y preparar todo». No aplicar migraciones, crear usuarios, restablecer contraseñas, ejecutar seeds ni publicar. Se preparan correcciones locales de fundaciones y el procedimiento de despliegue. No cerrar sprints con verificaciones pendientes.

## Continuación de cuentas de desarrollo

Se sustituyó el seed inseguro por un plan predeterminado y una ejecución --apply explícita con reversión de cada alta nueva si falla un paso. No modifica cuentas existentes. Se añadieron pruebas de adaptador, configuración y del comando con servicios falsos, más regresiones de autenticación. La ejecución directa de tsx está bloqueada por el entorno Windows; queda pendiente comprobarla en terminal normal. No se ejecutaron escrituras remotas ni se cerró Sprint 1.
