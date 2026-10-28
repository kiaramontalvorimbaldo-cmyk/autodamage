# Preparación de migración y despliegue

Estado: preparado localmente; no publicado ni aplicado por instrucción del usuario del 20/10/2026.

## Proyecto correcto

Trabajar en C:/Users/HP/Downloads/ProyectoIntegrador3/autodamage-ai. El arranque anterior de outputs/autodamage-ai es independiente y no debe mezclarse con estas migraciones. Se preservan los archivos 001, 002 y 003 originales.

## Antes de aplicar SQL

La URL y las claves de aplicación funcionan, pero no acreditan el historial de migraciones. Con una sesión autorizada de Supabase, consultar el historial y las políticas efectivas. El esquema ya contiene las 11 tablas y 20 piezas. No ejecutar 001 otra vez ni usar db reset. Verificar especialmente si vehiculos.creado_en ya existe (003).

La migración 004 limita UPDATE del perfil a nombre_completo, restringe los estados iniciales del asegurado, evita recursión entre las políticas de siniestros y órdenes y quita a talleres acceso directo a inspecciones privadas. Los cambios de órdenes se hacen por el handler autenticado y el caso de uso existente con service role. Se mantiene el trigger de auditoría inmutable. Revisar posibles políticas adicionales no incluidas en 001 antes de aplicar.

Usar Supabase CLI con sesión autorizada y contraseña de la base, o conexión Postgres de desarrollo. Primero listar migraciones, reconciliar historial solo después de compararlo con el esquema, ejecutar db push --dry-run y revisar; luego aplicar únicamente las pendientes. No marcar una migración como aplicada por intuición.

Tras aplicar en desarrollo, generar database.types.ts desde la instancia y ejecutar pruebas de integración de RLS con cuentas dedicadas. La batería heredada de integración necesita revisión: no basta comprobar que una consulta devuelve un arreglo para probar aislamiento; una política SELECT que filtra filas puede devolver [] sin error. No ejecutar sus escrituras contra datos ajenos.

## Vercel

Falta iniciar sesión en Vercel CLI o configurar VERCEL_TOKEN localmente. No hay proyecto Vercel enlazado detectado. Revisar antes si ya existe uno para el repositorio kiaramontalvorimbaldo-cmyk/autodamage. Vincular al existente en lugar de crear duplicados. Configurar las variables en el servidor de Vercel; service role y Gemini nunca llevan NEXT_PUBLIC_. No subir .env.local. Mantener AI_PROVIDER=mock para la validación automática.

Primero crear un despliegue de vista previa, verificar /api/health, registro con confirmación, login por cuatro roles, aislamiento y redirecciones. Promover a producción solo cuando se retome la autorización de publicar. Las cuentas demo existentes y sus contraseñas conocidas deben revisarse antes de exponer un despliegue público; el formulario ya no publica accesos rápidos, pero las cuentas no se han modificado.

## Verificación y cierre

Ejecutar lint, tipos, cobertura y build. Las pruebas de navegación sin sesión se pueden ejecutar sin escribir en Supabase. La prueba de usuario nuevo, RLS con escrituras, CI remoto y despliegue siguen pendientes. No cerrar Sprint 1 ni continuar al siguiente como si esos puntos ya estuvieran aprobados.

## Comprobación del 20/10/2026

La consulta explícita de vehiculos.creado_en devolvió HTTP 400 y código 42703: la columna falta. Revisar y aplicar la migración 003 antes de la 004. No se aplicó ninguna. Las migraciones 001–004 sí se ejecutaron satisfactoriamente en PostgreSQL en memoria, con 19 comprobaciones de permisos. Ver preparacion-sprint-1.md.
