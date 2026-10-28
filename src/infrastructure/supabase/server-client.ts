import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getEnv } from '@/lib/env';

type SetAllCookie = { name: string; value: string; options: CookieOptions };

/**
 * Cliente Supabase para Server Components.
 * El almacen de cookies de Next.js propaga automáticamente las
 * cookies de sesión a la respuesta.
 */
export async function createServerSupabaseClient() {
  const env = getEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: SetAllCookie[]) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Llamado desde un Server Component: la escritura de cookies
          // la maneja el Route Handler / middleware.
        }
      },
    },
  });
}
