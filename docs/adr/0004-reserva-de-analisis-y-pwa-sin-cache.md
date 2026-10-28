# Reserva del análisis y PWA sin caché de información privada

Fecha: 21 de octubre de 2026.

## Contexto

El análisis se programa después de responder al cliente. Dos solicitudes podían leer el mismo estado e iniciar trabajos duplicados. Además, la PWA necesitaba un comportamiento sin conexión sin guardar evidencias ni documentos autenticados. Las migraciones y el despliegue están pospuestos por indicación del usuario.

## Decisión

Reservar EN_PROCESO mediante una sola actualización condicional sobre columnas existentes: id, estado del siniestro y estado previo del análisis. Programar el trabajo solo si la actualización devuelve una fila. El reanálisis conserva etiquetas anteriores hasta terminar y se limita a casos pendientes o en revisión sin otro trabajo activo.

Usar un service worker mínimo de producción que deja las API y los recursos al navegador, envía las navegaciones a la red y ofrece únicamente una página genérica si no hay conexión. No usa Cache Storage ni conserva documentos autenticados, fotos, tokens o respuestas de API. Se limita la CSP a formularios del propio origen y se impide incrustar la aplicación en otros sitios.

## Consecuencias

La reserva evita duplicar trabajos iniciados por los handlers sin depender de memoria compartida entre servidores. Necesita la comprobación de concurrencia contra el PostgreSQL remoto antes del cierre. No recupera automáticamente procesos interrumpidos que queden EN_PROCESO ni hace transaccionales las múltiples escrituras de un análisis o de una orden.

La PWA necesita red para trabajar con siniestros y no ofrece consulta ni captura persistente sin conexión. Las pruebas de instalabilidad y de cámara en dispositivos reales siguen siendo necesarias.
