import { NextRequest, NextResponse } from 'next/server';
import { requerirSesion } from '@/lib/session';
import { toErrorResponse } from '@/lib/errors';
import { issueWorkOrder } from '@/application/use-cases/issue-work-order';
import { getClaimRepository, getAuditRepository, getWorkOrderRepository } from '@/composition';
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['PERITO', 'ADMIN']);
  if ('respuesta' in auth) return auth.respuesta;
  try {
    const { id } = await params;
    const orden = await issueWorkOrder(
      {
        repositorio: getClaimRepository(),
        ordenes: getWorkOrderRepository(),
        auditoria: getAuditRepository(),
      },
      id,
      'USUARIO',
      auth.sesion.usuarioId,
    );
    return NextResponse.json({
      orden,
      mensaje: orden
        ? 'Orden disponible para el taller asignado'
        : 'No hay talleres activos. Activa o registra uno y reintenta.',
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
