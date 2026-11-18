# AutoDamage AI

Aplicación web progresiva para reportar siniestros vehiculares, analizar fotografías y coordinar la revisión pericial y las órdenes de reparación.

## Alcance

- Asegurado. Registra vehículos, reporta incidentes con entre tres y cinco fotos capturadas en vivo y consulta el seguimiento.
- Perito. Revisa las evidencias, ajusta la evaluación y aprueba, rechaza o solicita información adicional.
- Taller. Consulta sus órdenes y registra recepción, reparación y finalización.
- Administrador. Gestiona peritos y talleres, consulta expedientes y auditoría y genera informes imprimibles.

El análisis usa Gemini o un proveedor simulado. El servidor calcula los costos mediante un baremo referencial de 20 piezas.

La ruta verde requiere daño leve, confianza mínima del 60 %, costo inferior a USD 500 y las demás comprobaciones de evidencia y riesgo. Los casos dudosos pasan a ruta amarilla. El daño grave o las señales de fraude derivan a ruta roja con revisión presencial. El rechazo requiere el dictamen de un perito.

## Reporte guiado del incidente

Los nuevos reportes requieren tipo de incidente, lugar de referencia, relato de al menos 30 caracteres, daños observados de al menos 10 caracteres y respuestas sobre otros vehículos y personas heridas. Se admite «No lo sé» y se avisa de respuestas contradictorias. La fecha y las coordenadas siguen siendo obligatorias.

El resumen se revisa antes de enviar y se genera nuevamente en el servidor. Se guarda en la descripción del expediente y aparece al asegurado, perito, taller y en el informe. No requiere una migración SQL ni modifica los reportes históricos. Los clientes de API deben enviar el objeto detalles; una descripción libre ya no basta para crear un siniestro.

## Tecnologías

Next.js 15, React 19 y TypeScript. El modo local usa PostgreSQL directo, contraseñas protegidas con scrypt, sesiones del servidor y una carpeta privada de evidencias. El adaptador anterior de Supabase se conserva durante la transición. MediaPipe procesa los rostros en el navegador. Vitest verifica el código y Serenity REST ejecuta pruebas de API. Jenkins usa el Jenkinsfile del repositorio.

El código se organiza en interfaz y rutas HTTP, casos de uso, dominio y adaptadores de infraestructura.

## Requisitos

Node.js 22 o superior, npm y PostgreSQL 18 instalado. En Windows se busca en C:/Program Files/PostgreSQL/18/bin; para otra instalación configura POSTGRES_BIN. Serenity requiere Java 17 o superior y Maven.

## Ejecución local sin Supabase

Desde la carpeta que contiene package.json:

```sh
npm ci
npm run local:setup
npm run local:seed
npm run local:dev
```

La configuración del servidor queda en .local/servidor. El primer comando de preparación crea una base PostgreSQL independiente y aplica local/migrations en orden, con control de integridad. No modifica la base remota. Las cuentas demo son asegurado@demo.com, perito@demo.com, taller@demo.com y admin@demo.com. La contraseña inicial es Demo123456!; puedes definir DEMO_PASSWORD antes de crear las cuentas. El sembrado conserva las contraseñas existentes.

.local contiene datos, fotografías y configuración privada generada automáticamente. Está excluida de Git: respáldala y no la borres. PostgreSQL escucha únicamente en 127.0.0.1; el servidor web escucha en la red local. Abre http://localhost:3000 en el equipo servidor o http://IP-DEL-EQUIPO:3000 desde la misma Wi-Fi. La cámara web necesita localhost o HTTPS; el acceso por IP mediante HTTP no habilita la cámara del navegador.

Para Gemini real configura AI_PROVIDER=gemini, GEMINI_API_KEY y GEMINI_MODEL en .env.local. Para pruebas sin llamadas externas usa AI_PROVIDER=mock. Las claves de Supabase no son necesarias al usar local:dev. Gemini continúa requiriendo Internet.

```sh
npm run local:status
npm run local:stop
npm run local:verify
```

local:verify prepara una base separada y verifica las API reales de acceso por roles, permisos, creación de vehículos y siniestros, fotografías privadas y cierre de sesión. Usa IA simulada y no abre Chromium. Conserva la base de comprobación en .local y detiene sus servicios al terminar.

El modo anterior sigue disponible con npm run dev si aún conservas la configuración de Supabase. No ejecutes las migraciones de local/migrations en Supabase.

Para ejecutar una compilación de producción usa npm run build y después npm run local:start.

## Trasladar los datos anteriores

```sh
node scripts/local/export-supabase.mjs RUTA-DEL-RESPALDO
node scripts/local/import-backup.mjs RUTA-DEL-RESPALDO
```

Exportar requiere las credenciales privadas del servicio anterior. La importación verifica integridad, exige un respaldo completo y tablas de destino vacías, y no sustituye datos existentes. Hazla después de local:setup y antes de local:seed. Si la exportación informa permiso denegado (42501) en mensajes_siniestro, aplica primero supabase/migrations/007_respaldo_chat.sql en el servicio anterior y repite el respaldo en una carpeta nueva. No se considera completa una exportación con errores. Las contraseñas antiguas no se exportan; las cuentas importadas requieren contraseñas locales nuevas.

## Pruebas y reportes

```sh
npm run lint
npm run typecheck
npm run test:ci
npm run build:ci
npm run test:serenity
```

Vitest genera junit-results/vitest.xml y coverage/index.html. La cobertura instrumenta src/domain, src/application y src/lib.

Serenity ejecuta las rutas de la aplicación con una dependencia de datos simulada y genera serenity-tests/target/site/serenity/index.html y resultados XML en serenity-tests/target/failsafe-reports. Para ejecutarlo con el servidor de desarrollo usa npm run test:serenity -- --dev.

La suite remota de RLS requiere las variables indicadas en tests/integration/rls.test.ts y usuarios de prueba preparados. Sin esa configuración, sus tres casos quedan omitidos.

## Jenkins

Configura el trabajo como Pipeline script from SCM, selecciona la rama correspondiente y usa Jenkinsfile como ruta del script. PROJECT_DIR vale . cuando package.json está en la raíz.

El agente necesita Node.js y npm. Configura las herramientas Java y Maven con los nombres de los parámetros SERENITY_JDK_TOOL y SERENITY_MAVEN_TOOL. Instala Git, Pipeline, JUnit y HTML Publisher para ejecutar el flujo y publicar los reportes.

## Conversación y entrega del taller

En modo local, local:setup aplica también el chat por siniestro y la fecha estimada. El modo anterior usa supabase/migrations/006_chat_y_entrega.sql.

El taller abre una orden para enviar hallazgos al perito y guardar la fecha estimada. El perito consulta y responde desde el expediente. La conversación se actualiza cada cinco segundos mientras la pestaña está visible. Los casos con perito registrado son accesibles a ese perito y al taller asignado. Los casos de vía rápida sin perito registrado pueden ser atendidos por peritos activos.

## Límites de validación

Los precios del baremo son valores de prueba. La precisión del análisis visual, el recorrido completo con servicios remotos y la evaluación de usabilidad requieren validación adicional. Las pruebas locales de API usan datos simulados.

## Android y avisos en la misma Wi-Fi

La aplicación Android es un contenedor nativo exclusivo del asegurado: reutiliza la interfaz del servidor y añade cámara y ubicación del teléfono. No funciona sin el servidor. Requiere Android 11 o superior. El código está en android y no contiene claves del servidor ni de Gemini.

1. En el equipo ejecuta npm run local:dev. Se aplicará automáticamente local/migrations/005_notificaciones.sql y se mostrarán las direcciones para Android.
2. Conecta el teléfono a la misma Wi-Fi. Instala .local/entregables/AutoDamage-Cliente.apk (compilación de demostración con firma de depuración).
3. Pulsa Servidor y escribe la IP y puerto del equipo, por ejemplo 192.168.1.20:3000. No escribas localhost en el teléfono.
4. Inicia sesión con una cuenta de asegurado. La app rechaza los otros roles. Registra vehículos y reporta un caso como en la web. Las fotos se toman con la cámara, se eliminan del archivo temporal y pasan por el difuminado de rostros antes de enviarse. Si falla el difuminado, no se suben.
5. Pulsa Activar avisos y concede el permiso de notificaciones. El servicio comprueba cambios cada 10 segundos; muestra una notificación persistente y permite detener la recepción. Los avisos recibidos abren el expediente. Salir de la sesión detiene la recepción en la siguiente comprobación.

Los avisos se guardan por usuario: reporte recibido, cambios de estado, fallo del análisis, solicitud de ampliación, orden asignada, recepción/reparación y cambio de fecha estimada de entrega. En la web se consultan en Avisos y se pueden marcar como leídos. La instalación de la migración no genera avisos retroactivos.

Este mecanismo usa consultas por Wi-Fi, no Firebase ni notificaciones push por Internet. El servidor debe estar encendido, el teléfono debe conservar la conexión y la sesión debe seguir vigente. Si Android fuerza el cierre de la app, hay que volver a abrirla y activar los avisos. Android 15 y posteriores limitan el tiempo del servicio dataSync en segundo plano a un total de seis horas por día. Es una solución para la demostración local, no un servicio de entrega permanente. El modo HTTP está limitado por la app a direcciones IPv4 privadas o de bucle local; úsalo en una red de confianza. Para distribución pública se necesita HTTPS y un mecanismo de entrega de notificaciones apto para producción.

Para generar nuevamente el APK usa npm run android:apk. Se necesita un JDK 17 o superior (JAVA_HOME), Android SDK con plataforma 36 (o 37 instalada) y Build Tools 36.0.0. El comando usa las herramientas del SDK sin descargar Gradle y deja el APK en .local/entregables. El proyecto también se puede abrir en Android Studio. La configuración local del SDK, los archivos de compilación, el APK y la firma de depuración quedan excluidos de Git.

Verificación realizada: compilación y firma del APK, pruebas de puente nativo y API, y recorrido real contra PostgreSQL de creación y lectura privada de avisos. Falta verificar cámara, ubicación y recepción en un teléfono físico: el emulador de este equipo no pudo iniciar por la aceleración de virtualización.

Referencias Android: [límites del servicio en segundo plano](https://developer.android.com/develop/background-work/services/fgs/timeout) y [seguridad del puente de WebView](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges).

## Jenkins: PostgreSQL real y APK

El pipeline ahora añade dos etapas a la compilación web y Serenity:

- API con PostgreSQL real aislado: ejecuta test:postgres:ci, crea una instancia temporal en un puerto libre, aplica las migraciones locales, carga datos ficticios y prueba la aplicación ya compilada. Verifica roles, revocación de sesiones, validación del reporte, evidencias privadas, análisis simulado, rechazo del perito y avisos por propietario. También comprueba los eventos SQL del taller y la fecha de entrega. La IA está simulada; la persistencia y las API son reales. No usa Supabase ni Chromium.
- Generar y verificar APK Android: compila Java y recursos, genera DEX, alinea y firma un APK de demostración, verifica su firma y produce metadata.json con SHA-256, número de ejecución y commit. No ejecuta la interfaz en un emulador ni prueba sensores físicos.

Configura estos parámetros del trabajo:

| Parámetro           | Configuración                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POSTGRES_BIN        | Carpeta que contiene initdb y pg_ctl. En este equipo: C:/Program Files/PostgreSQL/18/bin. Vacío usa esa ubicación en Windows o PATH en Linux.                                        |
| ANDROID_SDK_PATH    | Ruta del Android SDK accesible a la cuenta que ejecuta Jenkins. En este equipo: C:/Users/HP/AppData/Local/Android/Sdk. También se admite ANDROID_SDK_ROOT o ANDROID_HOME del agente. |
| SERENITY_JDK_TOOL   | Nombre exacto de un JDK 17 o superior en Tools de Jenkins. Se reutiliza para generar el APK.                                                                                         |
| SERENITY_MAVEN_TOOL | Nombre de Maven en Tools, para Serenity.                                                                                                                                             |

El agente necesita Node 22 o superior, PostgreSQL con sus binarios de servidor, JDK completo, Android Build Tools 36.0.0 y plataforma Android 36 o 37 instalada, además de Maven. Jenkins debe ejecutarse con una cuenta que pueda leer el SDK y crear procesos y carpetas temporales. En Linux initdb debe ejecutarse sin privilegios de root. No se instalan herramientas ni se aceptan licencias Android automáticamente. No hacen falta plugins nuevos respecto a Git, Pipeline, JUnit y HTML Publisher ya usados.

Al terminar aparecen los reportes HTML PostgreSQL real y Compilación APK Android, además de Cobertura Vitest y Serenity API Report. Los resultados JUnit de cada etapa se incorporan al historial. En Artefactos se puede descargar artifacts/android/AutoDamage-Cliente.apk y metadata.json. El APK tiene firma de depuración y es para la demostración; no está listo para publicar en Google Play.

Los reportes nuevos son HTML autónomo sin JavaScript ni recursos externos. Se publican incluso si falla una fase. El pipeline limpia las salidas de la ejecución anterior antes de probar y no archiva bases, contraseñas, evidencias temporales ni claves de firma. En post detiene y elimina únicamente la base temporal identificada bajo .local/ci-postgres; no toca .local/servidor. Los fallos de limpieza también marcan la ejecución como fallida.

Comprobación local equivalente, desde la raíz del proyecto:

```sh
npm run build:ci
npm run test:postgres:ci
npm run android:ci
node scripts/ci/cleanup-postgres.mjs
```

Los reportes quedan en reports/postgres y reports/android (index.html, junit.xml y results.json); los entregables de CI quedan en artifacts/android. Estas salidas no se suben a Git. La generación local habitual android:apk conserva su salida en .local/entregables.
