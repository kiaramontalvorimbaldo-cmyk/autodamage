import { NextRequest, NextResponse } from 'next/server';
import { createAuthRouteClient } from '@/infrastructure/supabase/route-client';
import { loginSchema } from '@/application/validations/auth';
import { esRol, portalPorRol } from '@/lib/portal-routes';
import { mensajeDeCodigo } from '@/lib/user-messages';
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'BODY_INVALIDO', message: mensajeDeCodigo('BODY_INVALIDO') } },
      { status: 400 },
    );
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        error: {
          code: 'VALIDACION_ERROR',
          message: mensajeDeCodigo('VALIDACION_ERROR'),
          details: parsed.error.issues,
        },
      },
      { status: 400 },
    );
  const { supabase, withCookies } = createAuthRouteClient(request);
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user)
    return withCookies(
      NextResponse.json(
        {
          error: {
            code: 'CREDENCIALES_INVALIDAS',
            message: mensajeDeCodigo('CREDENCIALES_INVALIDAS'),
          },
        },
        { status: 401 },
      ),
    );
  const profile = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', data.user.id)
    .maybeSingle<{ rol: string }>();
  if (profile.error || !profile.data || !esRol(profile.data.rol)) {
    await supabase.auth.signOut();
    return withCookies(
      NextResponse.json(
        { error: { code: 'SIN_PERMISO', message: mensajeDeCodigo('SIN_PERMISO') } },
        { status: 403 },
      ),
    );
  }
  return withCookies(NextResponse.json({ ok: true, destino: portalPorRol(profile.data.rol) }));
}
