# ADR 0001: Monolito modular en Next.js con capas aisladas

## Contexto

El proyecto necesita frontend (tres portales: asegurado, perito, taller) y
backend (API REST, integración con IA, reglas de negocio). El equipo es de 4
personas, el tiempo es de 10 semanas y todo debe ser gratuito. Se evaluaron:
(a) microservicios (Frontend + API separados), (b) monolito con backend
separado (p. ej. FastAPI en Render), (c) monolito modular en Next.js.

## Decisión

**Monolito modular en Next.js (App Router)** desplegado en Vercel, con:

- Frontend y API (Route Handlers) en el mismo proyecto.
- Separación lógica en capas con regla de dependencias verificable por ESLint:
  `app/ → application/ → domain/`, y `infrastructure/` implementando los
  puertos de `application/`.
- `domain/` sin dependencias externas (TypeScript puro, funciones puras).

## Consecuencias

**Positivas:**

- Un solo despliegue y un solo pipeline de CI; menos coordinación.
- El dominio puro es trivial de testear (cobertura ≥ 90 % realista).
- Los adaptadores (Supabase, Gemini) se pueden cambiar o simular
  (patrón Strategy/Repository) sin tocar reglas de negocio.
- Vercel Hobby cubre frontend + serverless functions gratis.

**Negativas:**

- El límite de tiempo de ejecución de funciones serverless obliga a hacer el
  análisis de IA asíncrono (`after()` de Next.js).
- El escalado futuro podría requerir extraer servicios; los puertos dejan
  claro por dónde cortar.
- Render "duerme" tras 15 min de inactividad (cold start de 30–60 s): se
  descartó por eso; el keep-alive de Supabase se hace con GitHub Actions.
