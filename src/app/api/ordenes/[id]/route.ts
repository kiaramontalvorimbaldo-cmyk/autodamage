import { NextRequest, NextResponse } from 'next/server';
import { AppError, toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { getClaimRepository, getStorageService, getWorkOrderRepository } from '@/composition';
import { EXPIRACION_URL_FIRMADA_SEG } from '@/domain/config';

/** Detalle de una orden: vehículo, piezas aprobadas, monto, imágenes firmadas. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requerirSesion(request, ['TALLER', 'PERITO', 'ADMIN']);
  if ('respuesta' in auth) return auth.respuesta;

  try {
    const { id } = await params;
    const ordenes = getWorkOrderRepository();
    const orden = await ordenes.obtenerOrdenPorId(id);
    if (!orden) {
      throw new AppError('ORDEN_NO_ENCONTRADA', 404, 'La orden no existe');
    }

    if (auth.sesion.rol === 'TALLER') {
      const taller = await ordenes.obtenerTallerPorUsuario(auth.sesion.usuarioId);
      if (!taller || taller.id !== orden.tallerId) {
        throw new AppError('SIN_PERMISO', 403, 'No es tu orden');
      }
    }

    const repositorio = getClaimRepository();
    const siniestro = await repositorio.obtenerSiniestroPorId(orden.siniestroId);
    const vehiculo = siniestro
      ? await repositorio.obtenerVehiculoPorId(siniestro.vehiculoId)
      : null;
    const inspeccion = siniestro
      ? await repositorio.obtenerInspeccionPorSiniestro(siniestro.id)
      : null;
    const evaluaciones = inspeccion
      ? await repositorio.listarEvaluacionesPorInspeccion(inspeccion.id)
      : [];
    const imagenes = siniestro ? await repositorio.listarImagenes(siniestro.id) : [];
    const almacen = getStorageService();
    const imagenesConUrl = await Promise.all(
      imagenes.map(async (img) => ({
        id: img.id,
        orden: img.orden,
        url: await almacen.urlFirmado(img.storagePath, EXPIRACION_URL_FIRMADA_SEG),
      })),
    );

    return NextResponse.json({
      orden,
      vehiculo,
      siniestro: siniestro
        ? {
            id: siniestro.id,
            descripcion: siniestro.descripcion,
            estado: siniestro.estado,
            ruta: siniestro.ruta,
          }
        : null,
      piezas: evaluaciones.filter((e) => e.aprobadoPorPerito),
      imagenes: imagenesConUrl,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
