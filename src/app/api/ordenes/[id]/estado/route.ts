import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { updateWorkOrder } from '@/application/use-cases/update-work-order';
import { getAuditRepository, getClaimRepository, getWorkOrderRepository } from '@/composition';

const bodySchema = z.object({
  estado: z.enum(['RECIBIDO', 'EN_REPARACION', 'COMPLETADO']),
});

/** Avanza el estado de una orden (solo el taller dueño). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['TALLER']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const { id } = await params;
    const parseado = bodySchema.safeParse(await request.json());
    if (!parseado.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDACION_ERROR',
            message: 'Estado inválido',
            details: parseado.error.issues,
          },
        },
        { status: 400 },
      );
    }

    await updateWorkOrder(
      {
        repositorio: getClaimRepository(),
        ordenes: getWorkOrderRepository(),
        auditoria: getAuditRepository(),
      },
      {
        ordenId: id,
        usuarioTaller: auth.sesion.usuarioId,
        nuevoEstado: parseado.data.estado,
      },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
