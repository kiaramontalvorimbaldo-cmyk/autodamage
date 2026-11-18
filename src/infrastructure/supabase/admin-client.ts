import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';
import { LocalDatabase } from '@/infrastructure/local/database';

let adminClient: ReturnType<typeof createClient> | undefined;

/**
 * Cliente Supabase con la service role key (solo servidor).
 * Bypasea RLS: se usa exclusivamente para escrituras del sistema
 * (análisis de IA, auditoría, creación de órdenes, seeds).
 * Nunca debe usarse desde el navegador.
 */
export function getAdminClient() {
  if (process.env.DATA_BACKEND === 'local')
    return new LocalDatabase() as unknown as ReturnType<typeof createClient>;
  const env = getEnv();
  adminClient ??= createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return adminClient;
}
