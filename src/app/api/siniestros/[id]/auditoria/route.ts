import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { getAuditRepository, getWorkOrderRepository } from '@/composition';

/**
 * Historial de auditoría de un siniestro y su orden (PERITO / ADMIN).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['PERITO', 'ADMIN']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const { id } = await params;
    const auditoria = getAuditRepository();
    const ordenes = getWorkOrderRepository();

    const delSiniestro = [
      ...(await auditoria.listarPorEntidad('siniestro', id)),
      ...(await auditoria.listarPorEntidad('siniestros', id)),
    ];

    const orden = await ordenes.obtenerOrdenPorSiniestro(id);
    const deLaOrden = orden ? await auditoria.listarPorEntidad('ordenes_trabajo', orden.id) : [];

    const combinado = [...delSiniestro, ...deLaOrden].sort((a, b) =>
      a.creadoEn.localeCompare(b.creadoEn),
    );

    return NextResponse.json({ registros: combinado });
  } catch (error) {
    return toErrorResponse(error);
  }
}
