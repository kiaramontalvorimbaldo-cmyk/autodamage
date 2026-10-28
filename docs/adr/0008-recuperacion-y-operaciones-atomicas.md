# 0008 - Recuperación de flujos y escrituras conjuntas

Fecha: 28 de octubre de 2026.

## Contexto

El usuario solicitó completar las ramas pendientes del recorrido, incluyendo ampliaciones de evidencias, envíos interrumpidos, órdenes pendientes y operaciones parcialmente persistidas. Las migraciones remotas y el despliegue continúan diferidos.

## Decisión

- Identificadores UUID estables para creación del reporte y cada fotografía. Repetir una solicitud conserva el recurso; reutilizar un identificador para otro reporte genera conflicto. Tras una interrupción, el detalle del reporte PENDIENTE ofrece completar la captura sin crear un caso nuevo. No se almacenan fotos privadas en almacenamiento persistente del navegador.
- Cada solicitud de ampliación se identifica con el evento inmutable DICTAMEN_REGISTRADO que la originó. Las fotos nuevas guardan una carpeta por solicitud dentro del caso. Se conserva la evidencia original y se permiten hasta cinco fotos adicionales por solicitud. La entrega se registra como AMPLIACION_ENTREGADA; continúa EN_REVISION, sin nueva aprobación automática.
- Migración 005: funciones exclusivas de service_role para guardar análisis, dictamen, imagen, entrega de ampliación, emisión de orden y avance del taller. Bloqueos de fila impiden decidir o cargar mientras otra operación cambia el mismo caso. Dictamen/estado/auditoría y orden/estado del caso/auditoría se confirman o revierten juntos.
- La asignación mantiene el algoritmo de menor carga, fecha más antigua e ID. La emisión se serializa y reutiliza la orden existente. Sin talleres activos vuelve a revisión; perito/admin pueden reintentar tras registrar o activar un taller.
- Cada reserva de IA lleva token y momento de inicio. Perito/admin pueden recuperar una ejecución detenida durante más de cinco minutos. Una respuesta o error de una ejecución anterior no puede sobrescribir el análisis nuevo.
- Auth y PostgreSQL no comparten transacción: los cambios de personal usan compensación y un error explícito de reconciliación si la compensación también falla.
- Si falta 005, las operaciones nuevas fallan con mensaje de migración pendiente. No se hace una vuelta automática a escrituras parciales en producción.

## Consecuencias

Aplicar 005 es requisito de activación. No se ha ejecutado sobre Supabase desde este trabajo. Los adaptadores en memoria conservan la implementación anterior para pruebas de dominio; la transaccionalidad real se verifica además ejecutando SQL PostgreSQL localmente. El despliegue y las pruebas con personas, cámara y GPS reales siguen siendo validación independiente.
