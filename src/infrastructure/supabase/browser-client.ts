import { createBrowserClient } from '@supabase/ssr';
import { getEnv } from '@/lib/env';

/**
 * Cliente Supabase para el navegador (componentes cliente de Next.js).
 * Usa cookies HttpOnly gestionadas por @supabase/ssr.
 */
export function createBrowserSupabaseClient() {
  const env = getEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
