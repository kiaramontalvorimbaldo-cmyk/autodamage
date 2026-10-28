import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('La URL de Supabase debe ser válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'La anon key de Supabase es requerida'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'La service role key de Supabase es requerida'),
  GEMINI_API_KEY: z.string().min(1, 'La API key de Gemini es requerida'),
  GEMINI_MODEL: z.string().min(1, 'El modelo de Gemini es requerido'),
  AI_PROVIDER: z.enum(['gemini', 'mock'], {
    message: 'AI_PROVIDER solo admite "gemini" o "mock"',
  }),
  DAILY_AI_QUOTA_LIMIT: z.coerce.number().int().min(1, 'Debe ser un entero positivo'),
  AI_MAX_RPM: z.coerce.number().int().min(1, 'Debe ser un entero positivo'),
  MOCK_AI_SCENARIO: z
    .enum([
      'leve-faro',
      'moderado-puerta',
      'severo-estructural',
      'recaptura',
      'baja-confianza',
      'sin-piezas',
      'json-invalido',
      'cuota-agotada',
    ])
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida y parsea un objeto de variables de entorno.
 * Lanza Error con el detalle de todas las variables inválidas o faltantes.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const detalles = parsed.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Variables de entorno inválidas:\n- ${detalles.join('\n- ')}`);
  }
  return parsed.data;
}

let cached: Env | undefined;

/**
 * Devuelve (y cachea) las variables de entorno validadas del proceso.
 * Falla al arrancar si falta alguna variable requerida.
 */
export function getEnv(): Env {
  cached ??= parseEnv(process.env as Record<string, string | undefined>);
  return cached;
}
