# 0009: Jenkins con reportes separados y entorno simulado

## Contexto

Se necesita ejecutar las pruebas desde un Jenkins conectado a GitHub y publicar resultados HTML y JUnit sin utilizar servicios o cuentas reales.

## Decisión

Usar un Pipeline declarativo compatible con Windows y Linux y comandos Node sin shell para ejecutar las herramientas. Mantener JUnit en `junit-results`, separado de las salidas que limpia Playwright. Publicar y archivar resultados desde `post always`, preservando los fallos. Compilar en `.next-ci` con claves ficticias y Gemini simulado. Ejecutar únicamente las cuatro suites públicas de navegador; las pruebas autenticadas y RLS remotas necesitan un entorno independiente.

## Consecuencias

Ante un timeout real de carga de módulos en Vitest dentro de Jenkins Windows, la ejecución CI pasa a procesos `forks` con un solo trabajador y archivos secuenciales. Se conserva el aislamiento y toda la suite; no se aplica `retry` a errores de pruebas. Se habilita cobertura en caso de fallo para publicar el resultado parcial sin convertirlo en éxito.

Actualización del 4 de noviembre de 2026: el usuario solicita ejecutar Jenkins sin Chromium. Se eliminan la instalación de navegador, la ejecución E2E, sus parámetros y su publicación; se conservan las pruebas Playwright para uso independiente. Jenkins ejecuta la suite Vitest completa y mantiene los fallos reales, los umbrales de cobertura, el XML JUnit y el HTML de cobertura. Se usa `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` al instalar dependencias. Las referencias a Chromium siguientes documentan la decisión anterior, ya sustituida.

Tras observar fallos reales de Jenkins, se sustituyó el acceso dinámico `env[flag]` por accesos directos. La preparación del navegador conserva el fallo sin impedir publicar reportes anteriores. Chromium se instala con `--only-shell` y un tiempo de inactividad de descarga de 120 segundos configurable, reduciendo la descarga sin cambiar las pruebas headless. Un bloqueo del CDN sigue requiriendo resolver la red del agente.

El agente necesita Node y Chromium con sus dependencias; Jenkins requiere JUnit y HTML Publisher. El build de prueba no sirve como despliegue de producción. La configuración del servidor y su política de publicación HTML se verifican al ejecutar el trabajo real. No cambia el flujo existente de GitHub Actions.
