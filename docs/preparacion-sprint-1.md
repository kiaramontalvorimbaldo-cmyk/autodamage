# AutoDamage AI — preparación del Sprint 1

Fecha: 20 de octubre de 2026. Estado: Sprint 1 abierto; trabajo limitado a verificar y preparar, según la última indicación del usuario.

## Proyecto revisado

C:/Users/HP/Downloads/ProyectoIntegrador3/autodamage-ai. Se encontró esta versión avanzada con configuración real y repositorio GitHub privado. Se trabajó sobre ella. El arranque anterior de outputs/autodamage-ai es otra versión y no debe mezclarse con sus migraciones.

## Continuación local: cuentas de prueba y autenticación

Se añadieron 53 pruebas: aprovisionamiento con reversión por cuenta, adaptador de Supabase paginado y con comprobación de errores, validación completa de cinco cuentas, registro sin escalación de rol, confirmación por correo y redirección de los cuatro roles. La batería completa tiene ahora 521 aprobadas y tres de integración remota omitidas.

El script muestra un plan por defecto y solo crea cuentas con --apply. No hay contraseñas predeterminadas ni se imprimen las configuradas. Se valida todo el lote antes de escribir. Si una cuenta ya existe con otro rol o una ficha incompleta, se detiene sin modificarla. Si falla una cuenta nueva, se intenta revertir solo esa alta; un error de reversión se informa expresamente. No se anuncian éxitos globales después de un fallo. Ver [guía de cuentas de desarrollo](cuentas-desarrollo.md).

Se ejecutó npm run seed:users:plan y el cargador tsx falló antes del programa por uv_os_get_passwd en el entorno aislado de Windows (código 1). El mismo script se verificó con seis pruebas aisladas que sustituyen los adaptadores: plan sin conexiones, falta de contraseñas, configuración incompleta, apply con cuentas falsas, fallo y reversión y opción inválida. No se ejecutó apply contra Supabase. Esta limitación sigue registrada, sin declarar el comando como verificado en una terminal normal.

## Resultado

Se corrigió el acceso ADMIN a /admin, se centralizó la comprobación de identidad con respaldo getUser, se añadieron controles de rol a los layouts y esqueletos de carga, se eliminó el acceso rápido con contraseñas del formulario y se corrigió el registro cuando necesita confirmación por correo. Los errores de acceso y health ya no muestran detalles internos.

Las pruebas de producción descubrieron una CSP que bloqueaba el arranque del formulario. Se corrigió con un nonce aleatorio por petición, propagado a Next y a la respuesta, y render dinámico. No se permiten unsafe-inline ni unsafe-eval para scripts en producción. Las pantallas de administración son provisionales, no un portal de gestión completo.

La migración nueva 004 limita cambios de perfil y de estado por el asegurado, evita ciclos entre políticas, restringe inspecciones privadas y conserva la auditoría inmutable. Las migraciones 001–003 originales permanecen sin cambios. Las órdenes se modifican desde los casos de uso autenticados del servidor; no se permite cambiar montos mediante acceso directo del taller a las tablas.

## Verificaciones ejecutadas

| Comprobación                                                                                 | Resultado real                                                                           |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| npm run lint                                                                                 | Código 0, sin errores                                                                    |
| npm run typecheck                                                                            | Código 0                                                                                 |
| npm run test:coverage                                                                        | Código 0, 521 aprobadas y 3 de integración remota omitidas                               |
| npm run build                                                                                | Código 0, Next 15.5.27                                                                   |
| Playwright, acceso-publico/login/sprint1-seguridad, modo mock y servidor de producción local | Código 0, 22 aprobadas en escritorio y móvil                                             |
| Migraciones 001–004 en PostgreSQL en memoria                                                 | Código 0, 19 comprobaciones aprobadas                                                    |
| Revisión de secretos en navegador                                                            | 73 archivos generados revisados; no se encontraron los valores de service role ni Gemini |
| Archivos .env privados versionados                                                           | Ninguno                                                                                  |
| Health local contra Supabase                                                                 | HTTP 200, status ok y db ok                                                              |
| npm run seed:users:plan                                                                      | Código 1 por el entorno Windows; flujo del script aprobado en seis pruebas aisladas      |
| npm run preflight                                                                            | Código 1: conexión válida pero falta vehiculos.creado_en                                 |

Cobertura del conjunto configurado (domain, application y lib): 89.5% de líneas, 92.2% de ramas y 93.68% de funciones. El dominio alcanza 100% de líneas; los módulos superan el umbral del 90%. Esta configuración no mide todos los componentes ni todos los adaptadores: no es una medición global de cada archivo del repositorio.

Las pruebas SQL locales usan PostgreSQL en memoria y un esquema de Auth simulado. Validan SQL, RLS, aislamiento por dueño, bloqueo de cambios de rol, acceso de taller e inmutabilidad de auditoría. No sustituyen la integración con Supabase Auth, Storage ni el historial real de migraciones. Durante estas pruebas se detectó y corrigió también el permiso de INSERT RETURNING para un asegurado legítimo.

## Bloqueo confirmado

Supabase contiene las 11 tablas, 20 piezas y datos de demostración. Sin embargo, consultar vehiculos.creado_en devuelve HTTP 400 y código PostgreSQL 42703 (columna inexistente). La migración 003 ya existe localmente para añadirla. La migración 004 correctiva está preparada y probada localmente, sin aplicar.

Que las tablas existan no acredita que el historial remoto de migraciones esté sincronizado. No ejecutar de nuevo 001, no restablecer la base y no marcar migraciones como aplicadas sin comparar el historial. Para continuar: revisar historial, aplicar las pendientes 003/004 que correspondan y repetir la integración en desarrollo con credenciales autorizadas.

## Criterios del Sprint 1

| Criterio                                                          | Estado                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------- |
| Lint, tipos, pruebas y build locales                              | ✔                                                              |
| Esquema y permisos corregidos en Supabase                         | ✘ Pendiente aplicar y verificar                                |
| Registro público fuerza ASEGURADO                                 | ✔ En SQL local; ✘ prueba de usuario nuevo en el entorno remoto |
| Inicio y redirección de cada rol                                  | ✔ Pruebas unitarias; ✘ login real de los cuatro roles          |
| Navegación persistente y salidas                                  | ✔ Componentes y navegación pública probados                    |
| CI remoto y despliegue Vercel                                     | ✘ No ejecutados                                                |
| Tipos generados desde la instancia y mediciones de cinco acciones | ✘ Pendientes                                                   |

## Qué no se hizo

No se aplicaron migraciones, no se ejecutaron seeds, no se crearon usuarios, no se cambiaron contraseñas, no se llamó a Gemini real, no se publicaron commits/PR y no se desplegó. Las cuentas demo existentes no se modificaron; sus contraseñas conocidas deben revisarse antes de una publicación pública. El seed de cuentas de desarrollo ya revierte las altas nuevas incompletas y conserva sin cambios las cuentas existentes. El lanzamiento real con tsx debe comprobarse fuera del entorno aislado de esta sesión.

## Continuación por sprints

1. Cerrar Sprint 1 después de aplicar y probar el esquema, crear/verificar cuentas de desarrollo cuando se autorice, ejecutar la prueba de usuario nuevo, generar tipos y verificar CI y despliegue.
2. Auditar y validar el backend/IA ya existente del Sprint 2, aprovechando el motor de dominio y sus pruebas. No reconstruirlo.
3. Validar el asistente y vehículos existentes del Sprint 3 contra el entorno conectado y teléfonos reales.
4. Verificar el ciclo entre asegurado, perito y taller del Sprint 4 con sesiones separadas.
5. Completar la administración, seguridad y mediciones del Sprint 5; la interfaz de gestión todavía falta.
6. Hacer validación real, accesibilidad, teléfonos y entrega del Sprint 6. No hay métricas de IA real ni pruebas de cámaras reales en esta revisión.

## Uso de la entrega

proyecto/ contiene una copia del código preparado, sin .env.local, sin Git, sin dependencias ni compilaciones. La carpeta de Descargas también conserva los cambios. Para ejecutar una copia: npm ci, copiar la configuración local de forma privada, npm run build y npm start. npm run preflight comprueba la conexión sin escribir y detectará el bloqueo hasta aplicar la columna.

validacion-sql/ contiene el verificador aislado. Desde esa carpeta: npm ci y node verify.mjs ../proyecto. No requiere secretos ni conexión a Supabase. El archivo no lee .env ni abre conexiones remotas.

Para repetir Playwright: instalar Chromium con npx playwright install chromium; iniciar el build en el puerto elegido; definir E2E_EXTERNAL_SERVER=1, E2E_BASE_URL=http://localhost:3010 y AI_PROVIDER=mock. Ejecutar solo acceso-publico.spec.ts, login.spec.ts y sprint1-seguridad.spec.ts para una validación sin crear datos. No ejecutar el flujo de registro/vehículos contra datos reales sin retomar la autorización.

No se midió la tabla antes/después de cinco acciones. La CSP con nonce obliga a renderizar documentos por petición, por lo que el rendimiento debe medirse tras desplegar. Medir siempre con build + start; mantener el proyecto fuera de OneDrive y evaluar la región de Supabase solo después de medir. La configuración heredada environmentMatchGlobs de Vitest genera un aviso de deprecación, sin impedir las pruebas.

Commit sugerido: fix(auth): completar preparación segura de cuentas de desarrollo

Referencias de implementación: [migraciones de Supabase](https://supabase.com/docs/guides/deployment/database-migrations), [despliegue con Vercel CLI](https://vercel.com/docs/projects/deploy-from-cli), [CSP de Next](https://nextjs.org/docs/app/guides/content-security-policy), [PGlite](https://pglite.dev/docs/).
