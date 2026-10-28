import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { getClaim } from '@/application/use-cases/get-claim';
import { getClaimRepository, getStorageService, getWorkOrderRepository } from '@/composition';
import type { Taller } from '@/domain/entities';

/**
 * Detalle de un siniestro con URLs firmadas de las evidencias.
 * Permiso: dueño (ASEGURADO), PERITO o ADMIN.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const { id } = await params;
    const detalle = await getClaim(
      {
        repositorio: getClaimRepository(),
        almacen: getStorageService(),
        ordenes: getWorkOrderRepository(),
      },
      id,
      auth.sesion.usuarioId,
      auth.sesion.rol,
    );

    let taller: Taller | null = null;
    if (detalle.orden) {
      taller = await getWorkOrderRepository().obtenerTallerPorId(detalle.orden.tallerId);
    }

    return NextResponse.json({
      siniestro: detalle.siniestro,
      imagenes: detalle.imagenes,
      inspeccion: detalle.inspeccion,
      evaluaciones: detalle.evaluaciones,
      orden: detalle.orden,
      taller,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
