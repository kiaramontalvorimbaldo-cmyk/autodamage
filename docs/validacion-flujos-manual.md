# Validación manual después de activar la migración 005

28 de octubre de 2026. Esta lista está preparada, no ejecutada sobre Supabase remoto ni sobre producción.

## Preparación

- [ ] Revisar las migraciones pendientes y aplicar 005 con el servidor detenido; después reiniciar con este código y sus variables existentes.
- [ ] Entrar en Admin > Personal y comprobar qué cuentas de perito y taller se utilizarán. Crear las que falten y conservar sus contraseñas temporales fuera del repositorio.
- [ ] Revisar los talleres activos. No asumir que una cuenta concreta recibirá todas las órdenes: la asignación usa carga y desempates. Los talleres de auditoría que sigan activos también participan.
- [ ] Comprobar el taller real indicado en cada caso. Una orden anterior no se reasigna al crear una cuenta nueva ni al desactivar el taller original.

## Recorridos por rol

| Comprobación | Acción | Resultado esperado |
| --- | --- | --- |
| Reporte inicial | Asegurado registra vehículo, datos y tres fotos en vivo | Un caso y una copia por foto; análisis inicial reservado una sola vez |
| Carga interrumpida | Cortar conexión durante una carga y restablecerla | Se puede reintentar con el mismo identificador o completar el caso PENDIENTE desde su detalle |
| Privacidad | Capturar una foto con rostro | Se aplica pixelado; si falla el detector, no se envía la imagen |
| Fotos insuficientes | Intentar análisis inicial con una o dos fotos | Bloqueo tanto en interfaz como en API |
| Revisión | Abrir caso AMARILLA/ROJA como perito | Evidencias, piezas, explicación y auditoría disponibles |
| Rechazo | Escribir observaciones y rechazar | Inspección, estado RECHAZADO y auditoría quedan confirmados juntos; no se emite orden |
| Ampliación | Perito indica qué falta; asegurado captura y entrega fotos nuevas | Se conservan las anteriores, la solicitud aparece entregada y el caso sigue EN_REVISION |
| Nuevo análisis | Perito usa Analizar fotos ampliadas | Se actualizan las piezas y el presupuesto, se conserva la inspección anterior y se exige nuevo dictamen humano |
| Aprobación | Perito aprueba piezas y presupuesto | Se guarda APROBADO y se intenta emitir una orden |
| Sin talleres | Probar en un entorno aislado sin talleres activos | Caso en revisión; tras activar un taller, Reintentar asignación recupera una sola orden |
| Taller | Entrar con la cuenta del taller indicado en la orden | Solo esa cuenta ve y avanza la orden: EMITIDA > RECIBIDO > EN_REPARACION > COMPLETADO |
| Cierre | Taller completa la reparación | Orden COMPLETADO y caso FINALIZADO se guardan juntos |
| Seguimiento | Asegurado actualiza su caso | Ve el taller y el avance real; no se muestra reparación solo por haber ruta verde |

## Errores y permisos

- [ ] Otro asegurado no puede consultar el caso ni responder su ampliación.
- [ ] Otro taller no puede consultar ni avanzar la orden.
- [ ] No se permite saltar un estado del taller ni emitir una orden nueva de un caso rechazado.
- [ ] Una solicitud de ampliación entregada no acepta más fotos; una nueva solicitud del perito tiene su propio identificador.
- [ ] Un reanálisis no elimina las inspecciones previas ni convierte automáticamente una ampliación en aprobación.
- [ ] Una ejecución detenida solo se recupera por perito/admin después de cinco minutos; el resultado antiguo no sobrescribe la ejecución nueva.
- [ ] Si falta la migración, aparece el aviso de activación pendiente; no hay vuelta automática a escrituras parciales.
- [ ] Probar cámara y GPS en teléfono real, con permisos concedidos y denegados, y selección manual del incidente.
- [ ] Repetir los recorridos en el entorno desplegado antes de considerar cerrado el funcionamiento en producción.

Las fotos, las cuentas y los cambios de negocio reales de esta lista requieren ejecución manual o una prueba remota expresamente autorizada. Las verificaciones automáticas locales usan simulaciones y PostgreSQL en memoria.
