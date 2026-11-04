# Proyecto independiente AutoDamage AI

La carpeta principal desde el 4 de noviembre de 2026 es:

```text
C:\Users\HP\Documents\Codex\2026-10-20\AutoDamage-AI
```

Esta copia conserva el código, las pruebas, las migraciones, los recursos públicos, Jenkinsfile, las dependencias instaladas, `.env.local` y el repositorio `.git` con los cambios pendientes. No necesita ninguna carpeta dentro de `le`. Las compilaciones y reportes se regeneran aquí. El PDF histórico de flujos se conserva en `docs/entregables/AutoDamage-AI-flujos-completos.pdf`.

Para abrir el proyecto en Visual Studio Code, selecciona esta carpeta. En su terminal:

```powershell
npm run dev
```

Para Jenkins, usa este repositorio con `Jenkinsfile` en su raíz y `PROJECT_DIR=.`. Realiza los próximos commits y pushes desde esta copia; la carpeta original conserva un repositorio separado y no recibe cambios nuevos automáticamente.

La aplicación sigue utilizando Supabase y Gemini según `.env.local`. No publiques ese archivo. La independencia se refiere a las carpetas locales; no convierte la aplicación en un sistema sin servicios externos.

Verificación tras copiar: tipos aprobados, suite Vitest completa aprobada con 654 casos y 3 remotos omitidos, login y manifiesto HTTP 200 desde un servidor iniciado en esta carpeta. No se borró el original.
