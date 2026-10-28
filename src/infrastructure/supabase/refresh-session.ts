import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';
import { contentSecurityPolicy } from '@/lib/security-headers';
import { esRol, esRutaProtegida, portalPorRol } from '@/lib/portal-routes';
type SetAllCookie = { name: string; value: string; options: CookieOptions };

/** Refresca cookies. Los layouts y handlers vuelven a comprobar la identidad y autorizan. */
export async function refreshSession(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  function nextResponse() {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('Content-Security-Policy', csp);
    const next = NextResponse.next({ request: { headers } });
    next.headers.set('Content-Security-Policy', csp);
    return next;
  }
  let response = nextResponse();
  function redirectTo(path: string) {
    const target = NextResponse.redirect(new URL(path, request.url));
    target.headers.set('Content-Security-Policy', csp);
    for (const cookie of response.cookies.getAll()) target.cookies.set(cookie);
    return target;
  }
  try {
    const env = getEnv();
    const client = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (values: SetAllCookie[]) => {
            for (const { name, value } of values) request.cookies.set(name, value);
            response = nextResponse();
            for (const { name, value, options } of values)
              response.cookies.set(name, value, options);
          },
        },
      },
    );
    const result = await client.auth.getClaims();
    let usuarioId = result.data?.claims.sub;
    if (result.error || typeof usuarioId !== 'string') {
      const fallback = await client.auth.getUser();
      usuarioId = fallback.error ? undefined : fallback.data.user?.id;
    }
    const path = request.nextUrl.pathname;
    if (typeof usuarioId !== 'string')
      return esRutaProtegida(path) ? redirectTo('/login') : response;
    // Las páginas públicas no tienen layout de portal: aquí se resuelve su destino.
    // Las páginas protegidas consultan el rol una sola vez en requireUser().
    if (path === '/login' || path === '/registro') {
      const { data } = await client
        .from('usuarios')
        .select('rol')
        .eq('id', usuarioId)
        .maybeSingle<{ rol: string }>();
      if (data && esRol(data.rol)) return redirectTo(portalPorRol(data.rol));
    }
    return response;
  } catch {
    return esRutaProtegida(request.nextUrl.pathname) ? redirectTo('/login') : response;
  }
}
