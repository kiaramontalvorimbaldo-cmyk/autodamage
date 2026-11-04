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

El pipeline tiene seis etapas: checkout y preparación, instalación con `npm ci`, calidad del código, verificación de tipos, pruebas unitarias e integración con cobertura y compilación. No instala Chromium ni ejecuta pruebas de navegador. Configura `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` durante la ejecución.

Las pruebas de CI usan Gemini simulado y valores ficticios de Supabase, sin necesitar secretos. Se conserva toda la suite Vitest de dominio, casos de uso, componentes, servicios, seguridad e integración local, incluidos sus umbrales de cobertura. El build `.next-ci` es exclusivamente para verificar la aplicación; para producción hay que compilar con la configuración real. Las tres pruebas RLS remotas necesitan un entorno separado y permanecen omitidas sin sus credenciales; no se cuentan como aprobadas.

## Resultados publicados

El pipeline usa accesos directos a las variables de Jenkins para evitar la firma `getAt` rechazada por su protección de scripts; no requiere aprobar esa firma ni desactivar la protección. Los reportes de navegador quedan fuera de este trabajo y no se publican resultados antiguos de Playwright.

| Resultado       | Archivo                    |
| --------------- | -------------------------- |
| JUnit de Vitest | `junit-results/vitest.xml` |
| Cobertura HTML  | `coverage/index.html`      |

Jenkins publica los resultados disponibles al terminar, también si una prueba falla. El fallo mantiene la ejecución como fallida. Archiva únicamente el XML de Vitest y la cobertura. Limpia reportes anteriores al comenzar para no mostrar resultados viejos. JUnit permite consultar casos, fallos y tendencias por ejecución; el HTML muestra líneas, ramas y funciones cubiertas. La compilación también debe pasar para obtener SUCCESS.

Si Jenkins bloquea la parte interactiva del HTML por su política de seguridad, configura con tu administrador un **Resource Root URL** en un origen separado o descarga los artefactos y ábrelos localmente. No desactives la política CSP.

## Verificación local equivalente

```sh
node scripts/ci/preflight.mjs
node scripts/ci/run.mjs lint
node scripts/ci/run.mjs typecheck
npm run test:ci
npm run build:ci
```

No se ejecutó el trabajo actualizado en tu servidor Jenkins: las comprobaciones locales no validan sus plugins o permisos. Sube los cambios a GitHub y ejecuta una construcción nueva de `main`. Las pruebas Playwright y sus comandos se conservan para ejecución independiente, pero no forman parte de este Jenkinsfile.

Referencias oficiales: [JUnit](https://www.jenkins.io/doc/pipeline/steps/junit/), [HTML Publisher](https://www.jenkins.io/doc/pipeline/steps/htmlpublisher/), [seguridad de reportes HTML](https://www.jenkins.io/doc/book/security/configuring-content-security-policy/), [Playwright en CI](https://playwright.dev/docs/ci).

## Comprobación de las correcciones (28 de octubre de 2026)

Nota histórica: esta comprobación corresponde a la versión anterior que incluía navegador. Desde el 4 de noviembre de 2026 el trabajo Jenkins no lo utiliza, por decisión del usuario tras los bloqueos de descarga en su red.

Lint y tipos aprobados; 649 pruebas Vitest aprobadas y 3 remotas omitidas; cobertura 92,13 %. Instalación de Headless Shell comprobada reutilizando la caché local. Las 24 pruebas públicas Playwright pasaron y generaron XML y HTML contra una compilación local con servidor iniciado por separado. El cierre automático del servidor de Playwright se bloqueó en este entorno Windows de verificación; esta comprobación no valida ese cierre en Jenkins. La publicación y la descarga en la red del agente quedan por confirmar al subir los cambios y ejecutar el trabajo real.

## Verificación sin navegador (4 de noviembre de 2026)

654 pruebas Vitest aprobadas, 3 remotas omitidas y cobertura de líneas 92,13 %. XML JUnit y HTML de cobertura generados. Lint y tipos aprobados. La compilación local encontró `EPERM` al crear `.next-ci/types/app/api` en Windows; no se marca como aprobada ni se elimina esta comprobación del pipeline. La ejecución actualizada en Jenkins queda por confirmar después del commit y push del usuario. No se han modificado las pruebas para convertir fallos en éxitos.
