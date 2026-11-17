# AutoDamage AI

Aplicación web progresiva para reportar siniestros vehiculares, analizar fotografías y coordinar la revisión pericial y las órdenes de reparación.

## Alcance

- Asegurado. Registra vehículos, reporta incidentes con entre tres y cinco fotos capturadas en vivo y consulta el seguimiento.
- Perito. Revisa las evidencias, ajusta la evaluación y aprueba, rechaza o solicita información adicional.
- Taller. Consulta sus órdenes y registra recepción, reparación y finalización.
- Administrador. Gestiona peritos y talleres, consulta expedientes y auditoría y genera informes imprimibles.

El análisis usa Gemini o un proveedor simulado. El servidor calcula los costos mediante un baremo referencial de 20 piezas.

La ruta verde requiere daño leve, confianza mínima del 60 %, costo inferior a USD 500 y las demás comprobaciones de evidencia y riesgo. Los casos dudosos pasan a ruta amarilla. El daño grave o las señales de fraude derivan a ruta roja con revisión presencial. El rechazo requiere el dictamen de un perito.

## Tecnologías

Next.js 15, React 19 y TypeScript. Supabase proporciona autenticación, PostgreSQL y almacenamiento privado. MediaPipe procesa los rostros en el navegador. Vitest verifica el código y Serenity REST ejecuta pruebas de API. Jenkins usa el Jenkinsfile del repositorio.

El código se organiza en interfaz y rutas HTTP, casos de uso, dominio y adaptadores de infraestructura.

## Requisitos

Node.js 22 o superior y npm. Para ejecutar la aplicación con persistencia se necesita un proyecto Supabase con las migraciones de supabase/migrations aplicadas en orden. Las pruebas de Serenity requieren Java 17 o superior y Maven en PATH o MAVEN_HOME.

## Ejecución local

Desde la carpeta que contiene package.json:

```sh
npm ci
```

Copia .env.example a .env.local y completa las variables de Supabase. Para el análisis real configura AI_PROVIDER=gemini, GEMINI_API_KEY y GEMINI_MODEL. Para la simulación usa AI_PROVIDER=mock. Mantén las credenciales en el archivo local excluido de Git.

```sh
npm run preflight
npm run dev
```

Abre http://localhost:3000. La cámara requiere permisos del navegador y un contexto seguro, como localhost o HTTPS.

Para preparar las cuentas de demostración, completa sus contraseñas en .env.local, revisa el plan y aplica la creación:

```sh
npm run seed:users:plan
npm run seed:users:apply
```

El catálogo inicial se carga con:

```sh
npx tsx scripts/seed-baremo.ts
```

Para compilar y ejecutar la aplicación:

```sh
npm run build
npm start
```

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

La migración supabase/migrations/006_chat_y_entrega.sql habilita los mensajes por siniestro y la fecha estimada de entrega. Aplícala después de las migraciones anteriores desde el editor SQL del proyecto Supabase.

El taller abre una orden para enviar hallazgos al perito y guardar la fecha estimada. El perito consulta y responde desde el expediente. La conversación se actualiza cada cinco segundos mientras la pestaña está visible. Los casos con perito registrado son accesibles a ese perito y al taller asignado. Los casos de vía rápida sin perito registrado pueden ser atendidos por peritos activos.

## Límites de validación

Los precios del baremo son valores de prueba. La precisión del análisis visual, el recorrido completo con servicios remotos y la evaluación de usabilidad requieren validación adicional. Las pruebas locales de API usan datos simulados.
