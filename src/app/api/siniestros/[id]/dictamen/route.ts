import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { dictamenSchema } from '@/application/validations/dictamen';
import { issueVerdict } from '@/application/use-cases/issue-verdict';
import {
  getAuditRepository,
  getBaremoRepository,
  getClaimRepository,
  getWorkOrderRepository,
} from '@/composition';

/**
 * Registra el dictamen de un PERITO (rol PERITO).
 * Observaciones obligatorias al rechazar.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['PERITO']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const { id } = await params;
    const crudo = await request.json();
    const parseado = dictamenSchema.safeParse(crudo);
    if (!parseado.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDACION_ERROR',
            message: 'El dictamen es inválido',
            details: parseado.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const estado = await issueVerdict(
      {
        repositorio: getClaimRepository(),
        baremo: getBaremoRepository(),
        auditoria: getAuditRepository(),
        ordenes: getWorkOrderRepository(),
      },
      {
        siniestroId: id,
        peritoId: auth.sesion.usuarioId,
        dictamenFinal: parseado.data.dictamen_final,
        observacionesPerito: parseado.data.observaciones_perito ?? null,
        kilometraje: parseado.data.kilometraje ?? null,
        ajustes: parseado.data.ajustes?.map((a) => ({
          evaluacionId: a.evaluacion_id,
          accionRequerida: a.accion_requerida,
          costoPiezaEstimado: a.costo_pieza_estimado,
          aprobadoPorPerito: a.aprobado_por_perito,
          observacionPieza: a.observacion_pieza ?? null,
        })),
      },
    );

    return NextResponse.json({ siniestroId: id, estado }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
