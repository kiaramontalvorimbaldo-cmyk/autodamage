import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { analyzeClaim } from '@/application/use-cases/analyze-claim';
import { startAnalysis } from '@/application/use-cases/start-analysis';
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
 * Inicia el análisis de IA de un siniestro (rol ASEGURADO, dueño).
 * Responde 202 de inmediato y ejecuta el análisis en segundo plano
 * con `after()` de next/server.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['ASEGURADO']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const { id } = await params;
    const repositorio = getClaimRepository();

    await startAnalysis(repositorio, id, auth.sesion.usuarioId);

    const usuarioId = auth.sesion.usuarioId;
    after(async () => {
      try {
        await analyzeClaim(
          {
            repositorio,
            baremo: getBaremoRepository(),
            almacen: getStorageService(),
            proveedorIa: getAiProvider(),
            limitadorRpm: getRateLimiter(),
            auditoria: getAuditRepository(),
            reloj: clockDelSistema,
            ordenes: getWorkOrderRepository(),
          },
          id,
          usuarioId,
        );
      } catch (error) {
        // analyzeClaim ya marca FALLIDO y audita; solo lo registramos.
        console.error('Error ejecutando el análisis en segundo plano:', error);
      }
    });

    return NextResponse.json({ analisis_estado: 'EN_PROCESO' }, { status: 202 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
