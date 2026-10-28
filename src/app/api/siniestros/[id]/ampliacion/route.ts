import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requerirSesion } from '@/lib/session';
import { AppError, toErrorResponse } from '@/lib/errors';
import { getAmendment, submitAmendment } from '@/application/use-cases/claim-amendment';
import { getClaimRepository, getAuditRepository } from '@/composition';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['ASEGURADO', 'PERITO', 'ADMIN']);
  if ('respuesta' in auth) return auth.respuesta;
  try {
    const { id } = await params;
    const repositorio = getClaimRepository();
    const caso = await repositorio.obtenerSiniestroPorId(id);
    if (!caso) throw new AppError('SINIESTRO_NO_ENCONTRADO', 404);
    if (auth.sesion.rol === 'ASEGURADO' && caso.aseguradoId !== auth.sesion.usuarioId)
      throw new AppError('SINIESTRO_AJENO', 403);
    return NextResponse.json(
      { ampliacion: await getAmendment({ repositorio, auditoria: getAuditRepository() }, id) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['ASEGURADO']);
  if ('respuesta' in auth) return auth.respuesta;
  try {
    const { id } = await params;
    const body = z.object({ ampliacion_id: z.string().uuid() }).safeParse(await request.json());
    if (!body.success) throw new AppError('VALIDACION_ERROR', 400);
    await submitAmendment(
      { repositorio: getClaimRepository(), auditoria: getAuditRepository() },
      id,
      auth.sesion.usuarioId,
      body.data.ampliacion_id,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
