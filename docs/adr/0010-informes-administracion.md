# 0010: Informes técnicos de siniestros en Administración

## Contexto

El administrador necesita documentos de presentación profesional con la estructura habitual de un expediente de seguros: identificación, antecedentes, valoración, dictamen, reparación y anexos. No existe una plantilla propia de una aseguradora especificada por el usuario.

## Decisión

Añadir un centro de reportes y un informe HTML por caso, con impresión A4 y guardado en PDF mediante el navegador, sin nuevas dependencias ni migraciones. Usar únicamente datos actuales guardados y evidencias privadas firmadas. Autorizar ADMIN antes de cada consulta y validar el UUID del caso. Distinguir estimación, dictamen humano y monto autorizado; indicar datos ausentes, ausencia de firma digital y alcance del documento. Las imágenes deben cargar antes de imprimir.

## Consecuencias

El documento no certifica cobertura ni vigencia de póliza y no sustituye un informe pericial firmado. No inventa deducibles o impuestos. La lista inicial está limitada a los últimos 100 casos, como el panel existente. El PDF es una instantánea local, sin persistencia adicional. Una evidencia inaccesible impide la impresión hasta recargar; las URLs firmadas no son enlaces públicos permanentes.

Referencia de estructura: [ejemplo publicado de informe técnico pericial de automóvil](https://g-static.copart.com/v1/AUTH_svc_depdoc/ids-g-prod-lpp/0225/ac1bed6dc4ca4fe8be229ccd35d4659c_O.pdf). Se utiliza una composición propia de AutoDamage AI.
