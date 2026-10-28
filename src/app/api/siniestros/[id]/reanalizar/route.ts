import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { analyzeClaim } from '@/application/use-cases/analyze-claim';
import { reanalyzeClaim } from '@/application/use-cases/reanalyze-claim';
import {
  getAiProvider,
  getAuditRepository,
  getBaremoRepository,
  getClaimRepository,
  getRateLimiter,
  getStorageService,
  getWorkOrderRepository,
} from '@/composition';
import { clockDelSistema } from '@/application/ports/clock';

export const maxDuration = 60;

/**
 * Reintenta el análisis de IA (rol PERITO).
 * Permitido solo si el siniestro tiene etiqueta IA_NO_DISPONIBLE
 * o analisis_estado = FALLIDO.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['PERITO']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const { id } = await params;
    const repositorio = getClaimRepository();
    const auditoria = getAuditRepository();

    await reanalyzeClaim({ repositorio, auditoria }, id, auth.sesion.usuarioId);

    const siniestro = await repositorio.obtenerSiniestroPorId(id);
    const aseguradoId = siniestro!.aseguradoId;

    after(async () => {
      try {
        await analyzeClaim(
          {
            repositorio,
            baremo: getBaremoRepository(),
            almacen: getStorageService(),
            proveedorIa: getAiProvider(),
            limitadorRpm: getRateLimiter(),
            auditoria,
            reloj: clockDelSistema,
            ordenes: getWorkOrderRepository(),
          },
          id,
          aseguradoId,
        );
      } catch (error) {
        console.error('Error en el reanálisis:', error);
      }
    });

    return NextResponse.json({ analisis_estado: 'EN_PROCESO' }, { status: 202 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
