# Evidencias privadas y análisis real

## Contexto

Las fotos almacenadas se servían como JPEG correctos, pero la CSP no permitía imágenes de Supabase. El proveedor mock devolvía un escenario fijo y los casos FAST_TRACK se presentaban como resueltos y con formulario de dictamen. El usuario autorizó corregir estos problemas y configurar una clave de Gemini.

## Decisión

Permitir imágenes firmadas de dominios Supabase en img-src, manteniendo privado el bucket. No exponer ni persistir sus URLs en documentación. Mostrar errores de evidencia legibles y permitir recorrer todas las fotos. Usar coordenadas normalizadas para las cajas y asociarlas únicamente con la foto de la evaluación.

Separar pendientes, seguimiento y resueltos con paginación única en el servidor. Reservar el dictamen a EN_REVISION sin análisis en curso, tanto en interfaz como en caso de uso. Los estados de reparación se derivan de la orden. No modificar retroactivamente los casos mock ni sus órdenes.

Configurar Gemini en el archivo local privado, enviar JSON Schema explícito y validar con Zod. Usar prompt v1.1 y distinguir los resultados simulados en su persistencia y presentación. Si Gemini falla se mantiene la degradación a revisión humana, sin sustituirla por un resultado mock.

## Consecuencias

Los siguientes análisis usan el proveedor real y los resultados anteriores conservan su origen. Se probaron únicamente dos controles sintéticos sin personas con Google; no se enviaron al proveedor las fotos existentes del usuario. Estas comprobaciones no equivalen a métricas de detección de fraude ni garantizan autenticidad.

Ubicación, administración, migraciones y despliegue quedan fuera de este cambio según las instrucciones del usuario.
