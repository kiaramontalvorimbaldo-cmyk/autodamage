# Jenkins: pruebas y reportes

El repositorio incluye un `Jenkinsfile` para Windows o Linux. No despliega ni aplica migraciones. No es necesario conectar Jenkins con esta conversación: sube los archivos a GitHub y ejecuta tu trabajo existente.

## Configuración del trabajo existente

- Debe ser un **Pipeline from SCM** que lea el `Jenkinsfile`. Un trabajo Freestyle no interpreta ese archivo automáticamente.
- El agente necesita Node.js 22 o superior (recomendado 24) y npm disponibles en PATH.
- Jenkins necesita los plugins **JUnit** y **HTML Publisher**, además de los de Pipeline y Git que utiliza el trabajo.
- Si subes el contenido de `proyecto` como raíz del repositorio, usa Script Path `Jenkinsfile` y parámetro `PROJECT_DIR=.`.
- Si conservas las carpetas superiores, usa Script Path `outputs/preparacion-sprint-1/proyecto/Jenkinsfile` y `PROJECT_DIR=outputs/preparacion-sprint-1/proyecto`.

Después de subir los cambios, usa «Construir ahora» o el disparador de GitHub que ya tengas configurado. No se modificó tu servidor Jenkins desde aquí.

## Qué ejecuta

Instala dependencias con `npm ci`, revisa estilo y tipos, ejecuta Vitest con cobertura, compila una aplicación de prueba e instala Chromium para ejecutar Playwright. En Linux, prepara previamente las dependencias del sistema de Chromium o activa `INSTALL_BROWSER_SYSTEM_DEPS` si el agente tiene permisos para instalarlas.

Las pruebas de CI usan Gemini simulado y valores ficticios de Supabase, sin necesitar secretos. El build `.next-ci` es exclusivamente para verificar la aplicación; para producción hay que compilar con la configuración real. Las pruebas de navegador seleccionadas cubren acceso público, login, seguridad y PWA, en escritorio y móvil. No ejecutan las pruebas que crean siniestros o vehículos en cuentas reales. Las pruebas RLS remotas requieren un entorno de prueba separado y permanecen omitidas sin sus credenciales.

## Resultados publicados

La instalación descarga únicamente Chromium Headless Shell, suficiente para las pruebas sin ventana de este pipeline. El tiempo máximo sin recibir datos aumenta de 30 a 120 segundos; se puede ajustar con `PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT` en el agente. Playwright reutiliza su caché entre ejecuciones y conserva la configuración de proxy del agente. Si la red bloquea el CDN, hay que configurar el proxy o un espejo autorizado según la [documentación de Playwright](https://playwright.dev/docs/browsers#install-behind-a-firewall-or-a-proxy); aumentar el tiempo no elimina un bloqueo de red.

Si falla la descarga, la ejecución queda fallida y omite las pruebas que necesitan el navegador, pero publica el XML de Vitest y la cobertura disponibles. El pipeline usa accesos directos a las variables de Jenkins para evitar la firma `getAt` rechazada por su protección de scripts; no requiere aprobar esa firma ni desactivar la protección.

| Resultado                 | Archivo                        |
| ------------------------- | ------------------------------ |
| JUnit de Vitest           | `junit-results/vitest.xml`     |
| JUnit de Playwright       | `junit-results/playwright.xml` |
| Cobertura HTML            | `coverage/index.html`          |
| Pruebas de navegador HTML | `playwright-report/index.html` |

Jenkins publica los resultados disponibles al terminar, también si una prueba falla. El fallo mantiene la ejecución como fallida. Archiva XML, cobertura, reporte de navegador y evidencias de fallos. Limpia reportes anteriores al comenzar para no mostrar resultados viejos. Los XML quedan fuera de `test-results` para que Playwright no borre los de Vitest.

Si Jenkins bloquea la parte interactiva del HTML por su política de seguridad, configura con tu administrador un **Resource Root URL** en un origen separado o descarga los artefactos y ábrelos localmente. No desactives la política CSP.

## Verificación local equivalente

```sh
node scripts/ci/preflight.mjs
node scripts/ci/run.mjs lint
node scripts/ci/run.mjs typecheck
npm run test:ci
npm run build:ci
node scripts/ci/run.mjs browsers
npm run test:e2e:ci
```

Playwright inicia la aplicación compilada en el puerto 3000; debe estar libre. No se ejecutó el trabajo en tu servidor Jenkins: la comprobación local valida los comandos y archivos generados, no los plugins o permisos de ese servidor.

Referencias oficiales: [JUnit](https://www.jenkins.io/doc/pipeline/steps/junit/), [HTML Publisher](https://www.jenkins.io/doc/pipeline/steps/htmlpublisher/), [seguridad de reportes HTML](https://www.jenkins.io/doc/book/security/configuring-content-security-policy/), [Playwright en CI](https://playwright.dev/docs/ci).

## Comprobación de las correcciones (28 de octubre de 2026)

Lint y tipos aprobados; 649 pruebas Vitest aprobadas y 3 remotas omitidas; cobertura 92,13 %. Instalación de Headless Shell comprobada reutilizando la caché local. Las 24 pruebas públicas Playwright pasaron y generaron XML y HTML contra una compilación local con servidor iniciado por separado. El cierre automático del servidor de Playwright se bloqueó en este entorno Windows de verificación; esta comprobación no valida ese cierre en Jenkins. La publicación y la descarga en la red del agente quedan por confirmar al subir los cambios y ejecutar el trabajo real.
