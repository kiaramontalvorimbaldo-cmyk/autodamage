import { NextRequest, NextResponse } from 'next/server';
import { requerirSesion } from '@/lib/session';
import { toErrorResponse } from '@/lib/errors';
import { consultarAdministracion } from '@/composition';

export async function GET(request: NextRequest) {
  const auth = await requerirSesion(request, ['ADMIN']);
  if ('respuesta' in auth) return auth.respuesta;
  try {
    return NextResponse.json(await consultarAdministracion(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
