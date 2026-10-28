# Cierre de los flujos pendientes

28 de octubre de 2026. Proyecto de trabajo: `outputs/preparacion-sprint-1/proyecto`.

## Funciones implementadas

| Pendiente | Comportamiento nuevo |
| --- | --- |
| Responder ampliación | El asegurado captura nuevas fotos desde el detalle, conserva las anteriores y entrega la solicitud al perito. Las instrucciones son obligatorias al pedir ampliación. |
| Recuperar reporte parcial | Un caso PENDIENTE y NO_INICIADO permite completar fotos y enviar a análisis sin crear otro caso. |
| Reintentar creación/carga | El mismo identificador reutiliza el reporte o la foto. Una respuesta perdida no genera necesariamente otro recurso. No se borra una foto cuya fila quedó confirmada. |
| Recuperar orden | Perito/admin pueden reintentar la emisión de un caso previamente aprobado o de vía rápida. Las órdenes existentes se reutilizan; los casos rechazados no generan órdenes nuevas. |
| Evitar escrituras parciales | Análisis, dictamen, emisión y avance de orden guardan sus cambios relacionados y auditoría en transacciones PostgreSQL. |
| Recuperar IA detenida | Tras cinco minutos, perito/admin pueden marcar la ejecución detenida como FALLIDO y reintentar el análisis. Tokens impiden que una respuesta anterior sobrescriba la nueva. |
| Recuperar cambios de personal | Si Auth no confirma el cambio, se intenta restaurar el perfil previo; una compensación fallida se informa para reconciliación. |
| Consultar avance | El asegurado dispone de Actualizar seguimiento; el seguimiento no termina automáticamente solo porque terminó la IA. |

## Activación pendiente, necesaria

1. Revisar y aplicar `supabase/migrations/005_atomic_workflows.sql` en el proyecto Supabase, después de las migraciones anteriores que correspondan.
2. Reiniciar el servidor local con este código y sus variables existentes.
3. Probar con cuentas de cada rol: reporte interrumpido, ampliación, aprobación/rechazo, emisión de orden, recepción, reparación y cierre.
4. Desplegar y repetir el recorrido en el entorno publicado y en teléfono real.

No se aplicaron migraciones remotas ni se desplegó. No se registraron dictámenes reales ni se modificaron asignaciones existentes. No activar el código nuevo sin 005: mostrará el error de migración pendiente al ejecutar operaciones protegidas.

## Diseño de las ampliaciones

El identificador de solicitud es el del último evento DICTAMEN_REGISTRADO de un caso cuya inspección mantiene AMPLIACION_REQUERIDA. Las imágenes se vinculan a ese identificador mediante `caso/ampliaciones/solicitud/imagen.jpg`, conservando el prefijo privado del caso. La entrega es idempotente, exige al dueño y al menos una foto; una solicitud ya entregada no admite más cargas. Una nueva solicitud del perito tiene otro identificador y su propio límite de fotos. El perito consulta las evidencias nuevas y emite un dictamen; el perito puede activar Analizar fotos ampliadas para actualizar las piezas y el presupuesto. Incluso si la IA propone daño leve, permanece EN_REVISION hasta un nuevo dictamen humano. El control temporal usa la recepción original de cada foto, no la fecha del reanálisis.

## Comprobaciones

- 644 pruebas aprobadas; 3 pruebas de RLS remoto omitidas por configuración. Se ejecutó la suite completa con cuatro trabajadores y un plazo por prueba de 20 segundos para la verificación en este equipo.
- 33 comprobaciones PostgreSQL locales aprobadas, incluida la separación entre solicitudes sucesivas de ampliación.
- 24 pruebas públicas de navegador aprobadas en escritorio y móvil. Se repitieron tras habilitar la conexión de la instancia de verificación a la red local.
- Lint, comprobación de tipos y compilación de producción aprobados. Se utilizó el modo serial opcional de compilación para resolver bloqueos de directorios de Windows.
- 79 archivos de cliente revisados: cero valores privados de Supabase o Gemini detectados.
- Las pruebas autenticadas remotas del recorrido completo quedan pendientes de aplicar las migraciones. No se consumieron llamadas reales de Gemini en estas pruebas.

La migración se ejecutó en PostgreSQL local en memoria, sin credenciales ni conexión a Supabase: 33 comprobaciones de RLS, transacciones, límites, idempotencia, permisos y tokens aprobadas. Incluye fallo de auditoría después de actualizar una orden, ajuste inválido en un lote, entrega ajena, fotos adicionales tras entrega, taller ajeno, salto de estado y resultado de IA antiguo.

## Límites que no desaparecen con este cambio

- La IA no certifica autenticidad ni detecta todas las imágenes falsas.
- La cámara y el GPS dependen del dispositivo y sus permisos.
- Los cortes entre Auth/Storage y PostgreSQL requieren comprobación y compensación; esos servicios no ofrecen una transacción común. Si no se puede confirmar ni compensar, se informa para revisión, sin inventar éxito.
- La recuperación de reporte conserva lo ya subido al servidor, no restaura fotos locales perdidas al cerrar el navegador.
- La pantalla y la API inicial exigen al menos tres fotos. Las ampliaciones requieren de una a cinco fotos nuevas por solicitud.

El PDF de flujos del 27 de octubre describe la versión anterior y conserva valor histórico; este documento registra los cambios posteriores.

## Archivos principales de la implementación

- `supabase/migrations/005_atomic_workflows.sql`: transacciones, permisos de funciones, reservas y recuperación de análisis.
- `src/application/use-cases/claim-amendment.ts`: solicitud y entrega de ampliación; `create-claim.ts`, `upload-image.ts` y `start-analysis.ts`: reintentos y validación del reporte.
- `src/application/use-cases/analyze-claim.ts`, `reanalyze-claim.ts`, `issue-verdict.ts`, `issue-work-order.ts` y `update-work-order.ts`: coordinación de operaciones seguras y recuperación.
- `src/application/ports/claim-repository.ts`, `work-order-repository.ts`; `src/domain/entities.ts`, `types.ts` y `triage/triage.ts`: contratos, metadatos y reglas de revisión humana.
- `src/infrastructure/repositories/supabase-repositories.ts`, `supabase-work-order-repository.ts` e `in-memory-claim-repository.ts`: adaptadores; `src/infrastructure/supabase/workflow-rpc.ts`, `workflow-error.ts` y `supabase-staff-repository.ts`: ejecución y compensaciones.
- Nuevas rutas `src/app/api/siniestros/[id]/ampliacion/route.ts`, `orden/route.ts` y `recuperar-analisis/route.ts`; actualización de creación del caso y carga de imágenes.
- `src/components/claim/additional-evidence.tsx`, `new-claim-wizard.tsx`, `src/components/recover-work-order.tsx` y `src/components/perito/VerdictForm.tsx`: pantallas y acciones.
- Detalles de asegurado, perito y administración; validaciones `siniestro.ts`, `dictamen.ts` y mensajes de usuario.
- Pruebas nuevas de recuperación, ampliación, revisión humana y compensación de personal; actualización de pruebas de reserva, ruta de análisis y formularios.
- `next.config.ts`: modo de compilación serial opcional mediante `AUTODAMAGE_SERIAL_BUILD=1`, para verificar en Windows cuando los procesos de compilación encuentran bloqueos de directorios. No cambia los flujos ni es requisito del servidor en producción.
- ADR 0008 y `docs/validacion-flujos-manual.md`: decisiones y comprobación posterior a la activación.
