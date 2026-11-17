import { AppError } from '@/lib/errors';
import { EXPIRACION_URL_FIRMADA_SEG } from '@/domain/config';
import type { ClaimRepository } from '@/application/ports/claim-repository';
import { firmarEvidencias, type StorageService } from '@/application/ports/storage-service';
import type { WorkOrderRepository } from '@/application/ports/work-order-repository';
import type { Orden, Taller } from '@/domain/entities';
import type { Rol } from '@/domain/types';

export type DetalleSiniestro = {
  siniestro: Awaited<ReturnType<ClaimRepository['obtenerSiniestroPorId']>>;
  imagenes: {
    id: string;
    orden: number;
    capturadaEn: string;
    latitud: number | null;
    longitud: number | null;
    url: string;
  }[];
  inspeccion: Awaited<ReturnType<ClaimRepository['obtenerInspeccionPorSiniestro']>>;
  evaluaciones: Awaited<ReturnType<ClaimRepository['listarEvaluacionesPorInspeccion']>>;
  orden: Orden | null;
  taller: Taller | null;
};

/**
 * Obtiene el detalle de un siniestro con URLs firmadas de las
 * evidencias. Permiso: el dueño (ASEGURADO), PERITO o ADMIN.
 */
export async function getClaim(
  deps: {
    repositorio: ClaimRepository;
    almacen: StorageService;
    ordenes?: WorkOrderRepository;
  },
  siniestroId: string,
  usuarioId: string,
  rol: Rol,
): Promise<DetalleSiniestro> {
  const siniestro = await deps.repositorio.obtenerSiniestroPorId(siniestroId);
  if (!siniestro) {
    throw new AppError('SINIESTRO_NO_ENCONTRADO', 404, 'El siniestro no existe');
  }

  const esDueno = siniestro.aseguradoId === usuarioId;
  if (!esDueno && rol !== 'PERITO' && rol !== 'ADMIN') {
    throw new AppError('SINIESTRO_AJENO', 403, 'No tienes acceso a este siniestro');
  }

  const repositorio = deps.repositorio;
  const ordenes = deps.ordenes;
  const [imagenesConUrl, { inspeccion, evaluaciones }, { orden, taller }] = await Promise.all([
    repositorio.listarImagenes(siniestroId).then(async (imagenes) => {
      const urls = await firmarEvidencias(
        deps.almacen,
        imagenes.map((imagen) => imagen.storagePath),
        EXPIRACION_URL_FIRMADA_SEG,
      );
      return imagenes.map(({ id, orden, capturadaEn, latitud, longitud }, i) => ({
        id,
        orden,
        capturadaEn,
        latitud,
        longitud,
        url: urls[i],
      }));
    }),
    repositorio.obtenerInspeccionPorSiniestro(siniestroId).then(async (inspeccion) => ({
      inspeccion,
      evaluaciones: inspeccion
        ? await repositorio.listarEvaluacionesPorInspeccion(inspeccion.id)
        : [],
    })),
    ordenes
      ? ordenes.obtenerOrdenPorSiniestro(siniestroId).then(async (orden) => ({
          orden,
          taller: orden ? await ordenes.obtenerTallerPorId(orden.tallerId) : null,
        }))
      : { orden: null, taller: null },
  ]);

  return { siniestro, imagenes: imagenesConUrl, inspeccion, evaluaciones, orden, taller };
}
