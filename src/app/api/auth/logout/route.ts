import { NextRequest, NextResponse } from 'next/server';
import { createAuthRouteClient } from '@/infrastructure/supabase/route-client';

/**
 * POST /api/auth/logout
 * Cierra la sesión y limpia las cookies de Supabase.
 */
export async function POST(request: NextRequest) {
  const { supabase, withCookies } = createAuthRouteClient(request);

  const { error } = await supabase.auth.signOut();

  if (error) {
    return withCookies(
      NextResponse.json(
        { error: { code: 'LOGOUT_ERROR', message: error.message } },
        { status: 400 },
      ),
    );
  }

  return withCookies(NextResponse.json({ ok: true }));
}
