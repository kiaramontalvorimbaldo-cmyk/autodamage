# 0009: Jenkins con reportes separados y entorno simulado

## Contexto

Se necesita ejecutar las pruebas desde un Jenkins conectado a GitHub y publicar resultados HTML y JUnit sin utilizar servicios o cuentas reales.

## Decisión

Usar un Pipeline declarativo compatible con Windows y Linux y comandos Node sin shell para ejecutar las herramientas. Mantener JUnit en `junit-results`, separado de las salidas que limpia Playwright. Publicar y archivar resultados desde `post always`, preservando los fallos. Compilar en `.next-ci` con claves ficticias y Gemini simulado. Ejecutar únicamente las cuatro suites públicas de navegador; las pruebas autenticadas y RLS remotas necesitan un entorno independiente.

## Consecuencias

El agente necesita Node y Chromium con sus dependencias; Jenkins requiere JUnit y HTML Publisher. El build de prueba no sirve como despliegue de producción. La configuración del servidor y su política de publicación HTML se verifican al ejecutar el trabajo real. No cambia el flujo existente de GitHub Actions.
