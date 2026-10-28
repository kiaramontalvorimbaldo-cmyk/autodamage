import { NextRequest, NextResponse } from 'next/server';
import { requerirSesion } from '@/lib/session';
import { AppError, toErrorResponse } from '@/lib/errors';
import { getClaimRepository } from '@/composition';
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['PERITO', 'ADMIN']);
  if ('respuesta' in auth) return auth.respuesta;
  try {
    const { id } = await params;
    const repo = getClaimRepository();
    if (!repo.recuperarAnalisis) throw new AppError('MIGRACION_PENDIENTE', 503);
    await repo.recuperarAnalisis(id, auth.sesion.usuarioId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
