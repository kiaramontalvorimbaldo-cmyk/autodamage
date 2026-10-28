# Continuación local: sprints 2 a 5

Fecha: 21 de octubre de 2026. Migraciones y despliegue pospuestos por indicación del usuario. Los cierres remotos continúan pendientes.

## Cambios y evidencia

| Sprint | Pendiente atendido                                                                              | Resultado local                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 2      | Archivos sin registro tras fallar la persistencia de imagen                                     | Compensación que elimina exclusivamente la ruta recién subida; distingue fallo de limpieza                                  |
| 2      | Solicitudes duplicadas de análisis                                                              | Reserva mediante UPDATE condicional por id, estado del siniestro y estado del análisis; solo el ganador programa el trabajo |
| 2      | Errores al comprobar cantidad, cuota y duplicidad tratados como resultados vacíos               | Se detiene el análisis cuando esas consultas fallan                                                                         |
| 3      | Stream de cámara que llega después de desmontar o falla al reproducir                           | Se detienen sus pistas; pruebas de ciclo de vida                                                                            |
| 3      | Difuminado dependiente de Canvas.filter y contexto ausente tratado como éxito                   | Pixelado de la región ampliada con lienzo auxiliar; fallo bloquea el envío                                                  |
| 3      | Hora de captura calculada después de procesar la imagen                                         | Se registra al capturar el fotograma                                                                                        |
| 3      | Polling que excede su límite si una consulta queda pendiente                                    | Plazo independiente, descarte de respuestas tardías y limpieza de temporizadores                                            |
| 4      | Reanálisis concurrente, borrado anticipado de señales y posibilidad de tocar decisiones finales | Reserva condicional, conservación de etiquetas durante el proceso y bloqueo de APROBADO/RECHAZADO/FINALIZADO                |
| 5      | Errores internos de Storage en respuestas HTTP                                                  | Mensajes públicos sin detalles del proveedor                                                                                |
| 5      | Evaluación con lista vacía de códigos y resultados reanudados desalineados                      | Códigos del baremo, unión por nombre de foto, validación CSV y firma del conjunto/modelo/prompt                             |
| 5      | Evaluación real activada por defecto                                                            | Plan local por defecto; --apply obligatorio para consumir cuota                                                             |

## Verificaciones ejecutadas

- Revisión de código y tipos: aprobadas.
- Batería con cobertura: 578 pruebas aprobadas y tres de RLS remoto omitidas. Cobertura de líneas: 91,75 % dentro de los archivos configurados en Vitest, no de todo el repositorio.
- Después de esa batería se añadieron y aprobaron tres pruebas del adaptador Storage. Comprueban ruta exacta de limpieza y mensajes sin detalles privados.
- Handler HTTP de análisis: cuatro pruebas; dos solicitudes simultáneas producen un 202 y un 409, con un único callback de trabajo.
- Reserva en adaptador Supabase: pruebas con HTTP interceptado comprueban las condiciones de la actualización y propagación de errores. No equivalen a una prueba de concurrencia contra PostgreSQL remoto.
- Evaluación: pruebas del CSV, alineación y ejecución del comando con proveedores falsos. No se llamó a Gemini real ni se generaron métricas de precisión reales.

## Evaluación de IA preparada para ejecución posterior

Preparar tests/validation/etiquetas.csv con cabecera archivo,severidad,piezas,es_recaptura. Usar JPEG dentro de tests/validation/imagenes, nombres sin directorios, piezas separadas por | y valores true/false. Se rechazan duplicados, códigos fuera del baremo, severidad inválida y rutas que salgan de la carpeta.

Ejecutar npx tsx scripts/evaluar-ia.ts --plan para comprobar el conjunto sin contactar al proveedor. Con un conjunto validado y configuración real, --apply ejecuta Gemini. El comando valida todas las rutas antes de consumir cuota y guarda avances tras cada resultado exitoso. Ante fallo se detiene; la foto podrá reintentarse al reanudar. El progreso incluye una firma de CSV, imágenes, códigos, modelo y prompt. Un archivo de progreso antiguo o de otro conjunto no se reutiliza automáticamente: conservarlo con otro nombre para iniciar una evaluación nueva.

El informe incluye versión de prompt, matriz de confusión, métricas de piezas/recaptura y latencias. La distribución de rutas, los teléfonos reales y Lighthouse requieren verificaciones adicionales. La limitación local previa del cargador tsx de Windows continúa documentada; las pruebas del comando utilizan la transformación de Vitest.

## Criterios aún abiertos

- Sprint 2: recorrido completo por HTTP con autenticación real y persistencia; llamada manual con Gemini real; fotos etiquetadas; transacción de inspección/evaluaciones/estado y límites diarios entre múltiples instancias.
- Sprint 3: captura, ubicación, privacidad y accesibilidad en teléfonos reales; verificación conectada del dictamen. La nueva pixelación exige comprobación visual en dispositivos, aunque sus operaciones y bloqueo ante fallo tienen pruebas automatizadas.
- Sprint 4: E2E de sesiones separadas asegurado/perito/taller y RLS real. Las reservas no convierten todas las escrituras en transacciones; también quedan pendientes el límite de subidas concurrentes y consistencia ante fallos de red durante una escritura.
- Sprint 5: fotos con doble etiquetado, métricas reales de IA y rendimiento, Lighthouse, manual con capturas y demo, revisión final de seguridad y publicación. No se declara el cierre de estos sprints.

## Cierre de la revisión local

Tras añadir la PWA mínima, la batería completa suma 588 pruebas aprobadas y tres remotas omitidas. Cobertura de líneas del conjunto configurado: 91,76 %. Se añadió un service worker que no usa Cache Storage y solo ofrece una página genérica cuando falla una navegación por falta de red. No intercepta las peticiones de API ni almacena documentos, sesiones o fotos. Su registro se limita a producción y su archivo se sirve sin caché de actualización. Las cabeceras ahora restringen object-src, base-uri, frame-ancestors y form-action.

La compilación de producción y ESLint terminaron con código 0. Playwright ejecutó 24 pruebas públicas y de seguridad en móvil emulado y escritorio sobre el servidor de producción local: todas aprobadas en 9,1 segundos. Incluyen registro y control del service worker, aviso sin conexión y comprobación de Cache Storage vacío. Las primeras ejecuciones encontraron restricciones de red del entorno; se habilitó el acceso local, se reinició el servidor y la ejecución completa posterior pasó. No se confunde móvil emulado con validación en teléfonos reales.

No se modificó el esquema remoto, no se desplegó, no se cambiaron credenciales ni se crearon cuentas reales.
