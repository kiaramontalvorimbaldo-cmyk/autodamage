import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';
import { LocalDatabase } from '@/infrastructure/local/database';
import { tokenFrom, localUser } from '@/infrastructure/local/auth';

/** Elemento devuelto por Supabase en `setAll` (cookie con sus opciones). */
type SetAllCookie = { name: string; value: string; options: CookieOptions };

/**
 * Cliente Supabase para Route Handlers de autenticación.
 *
 * Reenvía las cookies del request a Supabase y acumula las cookies
 * de respuesta (sesión) para que el handler pueda devolverlas junto
 * con su propio JSON mediante `withCookies(response)`.
 */
export function createAuthRouteClient(request: NextRequest) {
  if (process.env.DATA_BACKEND === 'local') {
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        const user = await localUser(tokenFrom(request));
        return new LocalDatabase(user.usuarioId).rpc(name, args);
      },
    };
    return {
      supabase: client as unknown as ReturnType<typeof createServerClient>,
      withCookies: <T extends Response>(response: T) => response,
    };
  }
  const env = getEnv();
  const pendingCookies: SetAllCookie[] = [];

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: SetAllCookie[]) => {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
            pendingCookies.push(cookie);
          }
        },
      },
    },
  );

  /**
   * Añade las cookies de sesión acumuladas a cualquier Response
   * (p. ej. Response.json(...)) para que el navegador las guarde.
   */
  function withCookies<T extends Response>(response: T): T {
    if (pendingCookies.length === 0) return response;
    const carrier = new NextResponse(null);
    for (const { name, value, options } of pendingCookies) {
      carrier.cookies.set(name, value, options);
    }
    for (const setCookie of carrier.headers.getSetCookie()) {
      response.headers.append('Set-Cookie', setCookie);
    }
    return response;
  }

  return { supabase, withCookies };
}
