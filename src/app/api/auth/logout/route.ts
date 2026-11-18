import { NextRequest, NextResponse } from 'next/server';
import { createAuthRouteClient } from '@/infrastructure/supabase/route-client';
import { logoutLocal } from '@/infrastructure/local/auth';
import { toErrorResponse } from '@/lib/errors';

/**
 * POST /api/auth/logout
 * Cierra la sesión y limpia las cookies de Supabase.
 */
export async function POST(request: NextRequest) {
  if (process.env.DATA_BACKEND === 'local') {
    try {
      return await logoutLocal(request);
    } catch (error) {
      return toErrorResponse(error);
    }
  }
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
