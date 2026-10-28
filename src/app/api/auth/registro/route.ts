import { NextRequest, NextResponse } from 'next/server';
import { createAuthRouteClient } from '@/infrastructure/supabase/route-client';
import { registroSchema } from '@/application/validations/auth';
import { mensajeDeCodigo } from '@/lib/user-messages';

/**
 * POST /api/auth/registro
 * Crea un usuario nuevo con Supabase Auth.
 * El trigger on_auth_user_created lo registra en public.usuarios
 * con rol forzado 'ASEGURADO' (el registro público no acepta otros roles).
 */
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

  const parsed = registroSchema.safeParse(body);
  if (!parsed.success) {
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
  }

  const { supabase, withCookies } = createAuthRouteClient(request);

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { nombre_completo: parsed.data.nombreCompleto },
    },
  });

  if (error) {
    return withCookies(
      NextResponse.json(
        { error: { code: 'REGISTRO_ERROR', message: mensajeDeCodigo('REGISTRO_ERROR') } },
        { status: 400 },
      ),
    );
  }

  if (!data.session) {
    return withCookies(
      NextResponse.json(
        {
          error: {
            code: 'CONFIRMACION_PENDIENTE',
            message: mensajeDeCodigo('CONFIRMACION_PENDIENTE'),
          },
        },
        { status: 202 },
      ),
    );
  }

  return withCookies(NextResponse.json({ ok: true, userId: data.user?.id }));
}
