# Corrección de evidencias, flujo del perito y Gemini

Fecha: 27 de octubre de 2026. Proyecto: outputs/preparacion-sprint-1/proyecto.

## Configuración real

La clave facilitada por el usuario se guardó exclusivamente en GEMINI_API_KEY dentro del .env.local existente. No se copia a esta documentación, al ejemplo de entorno ni al navegador. AI_PROVIDER=gemini; GEMINI_MODEL=gemini-3.5-flash-lite. El modelo fue confirmado en la lista de modelos de la cuenta. Los límites internos de cuota siguen configurados; la cuota efectiva depende de Google.

Se corrigió el adaptador para enviar JSON Schema serializable con responseJsonSchema, en lugar de pasar un objeto Zod como responseSchema. Zod valida el contenido recibido. El prompt v1.1 añade comprobaciones de evidencia pertinente, recapturas e instrucciones maliciosas dentro de fotos. El modo mock se marca explícitamente y nunca es un sustituto silencioso de Gemini cuando falla.

Se realizaron dos llamadas reales con controles sintéticos generados localmente: una imagen sin vehículo y un dibujo de auto. Ambas devolvieron JSON válido, cero piezas, sospecha de recaptura y confianza 0/0,1; ninguna cumple condiciones de verde. Los resultados están en outputs/verificacion-fotos-gemini.json. No se transmitieron a Gemini fotos existentes de personas ni se crearon siniestros durante esta verificación.

Referencias oficiales: [salidas estructuradas](https://ai.google.dev/gemini-api/docs/structured-output), [modelos](https://ai.google.dev/api/models), [precios y nivel gratuito](https://ai.google.dev/gemini-api/docs/pricing).

## Imágenes

Las seis evidencias consultadas en Storage respondieron 200 con cabecera JPEG y firma de archivo válida. La CSP omitía Supabase en img-src: se añadió su dominio sin abrir un comodín global ni hacer público el bucket. Se añadió una explicación para archivos ausentes o accesos caducados. El perito puede recorrer todas las fotos; las cajas usan SVG normalizado y se dibujan solo en la foto vinculada a la evaluación.

## Flujo

- Pendientes: EN_REVISION.
- En seguimiento: PENDIENTE, FAST_TRACK y APROBADO.
- Resueltos: RECHAZADO y FINALIZADO.

Cada bandeja tiene una consulta y paginación de servidor, sin combinar cuatro páginas de estados diferentes. Se descartan respuestas antiguas al cambiar filtros. El dictamen y los ajustes solo se ofrecen en revisión, sin un análisis en curso; el servidor conserva el mismo control. Las piezas no aprobadas no se suman al presupuesto ajustado.

La línea temporal usa la orden: EMITIDA no significa EN_REPARACION. Los casos simulados se señalan con un aviso y no se reevalúan automáticamente al activar Gemini, para no cambiar decisiones u órdenes anteriores.

## Validación

Compilación de producción y comprobación de tipos aprobadas. Playwright: 24 pruebas públicas/de seguridad aprobadas. Batería final con cobertura: 606 pruebas aprobadas y tres remotas omitidas; cobertura de líneas del conjunto configurado: 91,79 %. Incluye bloqueo del dictamen durante reanálisis, exclusión de piezas no aprobadas y reintento de un análisis fallido pendiente. Se revisaron 73 archivos del cliente generado sin encontrar los valores privados de Gemini o Supabase.

En navegador, con la cuenta de perito: el caso eca2b956 aparece en seguimiento; sus tres fotos y la imagen principal cargan con ancho 640; los cuatro campos de piezas están deshabilitados y no existe el botón de dictamen. En el caso EN_REVISION 88caeb47 sí se habilitan edición y dictamen. No se envió ningún dictamen ni se cambió un caso existente.

## Uso

Reiniciar el servidor local con Ctrl+C y npm run dev para recargar código, cabeceras y variables. Crear un reporte nuevo para probar Gemini. Los casos anteriores mantienen sus resultados de prueba; el aviso lo explica. No se garantiza detectar todas las falsificaciones: los indicios requieren revisión humana.

Ubicación y administración no se modificaron. No se aplicaron migraciones ni se desplegó.
