# Preparación sobre el proyecto existente

Contexto: se encontró una versión avanzada en Descargas con configuración real y repositorio privado. Supabase ya tiene datos. El usuario indicó limitarse a verificar y preparar.

Decisión: trabajar sobre esa versión, conservar las migraciones 001–003, preparar una migración 004 correctiva sin aplicarla y no ejecutar seeds ni desplegar. Se conserva Next 15.5.27 fijado y middleware.ts. Se usa getClaims con respaldo getUser. El middleware no lee roles en páginas protegidas; los layouts y handlers autorizan con requireUser. Los handlers conservan su interfaz requerirSesion y resuelven la misma identidad. React.cache comparte la lectura durante el render de una petición; no es una caché global ni sustituye autorización en los handlers.

Se elimina el acceso rápido con contraseñas publicadas en el formulario. Las cuentas demo existentes no se modifican; sus credenciales deben revisarse antes de publicar. ADMIN llega a un portal provisional /admin. Las pantallas de administración completas pertenecen al Sprint 5.

Consecuencias: el despliegue y las pruebas con escrituras de usuarios nuevos quedan pendientes. No se declara cerrado el Sprint 1 ni se cambia a otro sprint. Las pruebas locales podrán ejecutarse en una copia de verificación bajo work/ si el aislamiento de Windows impide a esbuild leer rutas superiores de Descargas.

La verificación de producción detectó que la CSP estática bloqueaba los scripts inline de arranque de Next y dejaba el acceso sin contenido. Se genera un nonce criptográfico por petición, se propaga por cabeceras de solicitud y respuesta y se fuerza render dinámico. No se permite unsafe-inline ni unsafe-eval en script-src de producción. Se pierde la prerenderización estática de páginas; validar tiempos tras desplegar. Referencia: https://nextjs.org/docs/app/guides/content-security-policy
