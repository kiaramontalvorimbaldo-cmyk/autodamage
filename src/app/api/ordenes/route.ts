import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { getWorkOrderRepository } from '@/composition';
import type { EstadoOrden } from '@/domain/types';

const ESTADOS: EstadoOrden[] = ['EMITIDA', 'RECIBIDO', 'EN_REPARACION', 'COMPLETADO'];

/** Lista órdenes: TALLER ve las suyas, PERITO/ADMIN todas. Filtro por estado. */
export async function GET(request: NextRequest) {
  const auth = await requerirSesion(request, ['TALLER', 'PERITO', 'ADMIN']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const estadoCrudo = request.nextUrl.searchParams.get('estado');
    const estado =
      estadoCrudo && (ESTADOS as string[]).includes(estadoCrudo)
        ? (estadoCrudo as EstadoOrden)
        : undefined;

    const ordenes = getWorkOrderRepository();

    if (auth.sesion.rol === 'TALLER') {
      const taller = await ordenes.obtenerTallerPorUsuario(auth.sesion.usuarioId);
      if (!taller) {
        return NextResponse.json({ ordenes: [] });
      }
      return NextResponse.json({
        ordenes: await ordenes.listarOrdenesPorTaller(taller.id, estado),
      });
    }

    return NextResponse.json({
      ordenes: await ordenes.listarTodasLasOrdenes(estado),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
