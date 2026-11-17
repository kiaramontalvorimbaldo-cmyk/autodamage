import { NextRequest, NextResponse } from 'next/server';
import { AppError, toErrorResponse } from '@/lib/errors';
import { requerirSesion } from '@/lib/session';
import { getClaimRepository, getStorageService, getWorkOrderRepository } from '@/composition';
import { firmarEvidencias } from '@/application/ports/storage-service';
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
    const [vehiculo, evaluaciones, imagenesConUrl] = await Promise.all([
      siniestro ? repositorio.obtenerVehiculoPorId(siniestro.vehiculoId) : null,
      siniestro
        ? repositorio
            .obtenerInspeccionPorSiniestro(siniestro.id)
            .then((inspeccion) =>
              inspeccion ? repositorio.listarEvaluacionesPorInspeccion(inspeccion.id) : [],
            )
        : [],
      siniestro
        ? repositorio.listarImagenes(siniestro.id).then(async (imagenes) => {
            const urls = await firmarEvidencias(
              getStorageService(),
              imagenes.map((imagen) => imagen.storagePath),
              EXPIRACION_URL_FIRMADA_SEG,
            );
            return imagenes.map(({ id, orden }, i) => ({ id, orden, url: urls[i] }));
          })
        : [],
    ]);

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
