import { AppError } from '@/lib/errors';
import { MAX_BYTES_IMAGEN, MAX_IMAGENES } from '@/domain/config';
import type { ClaimRepository } from '@/application/ports/claim-repository';
import type { ImageService } from '@/application/ports/image-service';
import type { StorageService } from '@/application/ports/storage-service';
import type { ImagenSiniestro } from '@/domain/entities';
import type { AuditRepository } from '../ports/audit-repository';
import { getAmendment } from './claim-amendment';

export type SubirImagenInput = {
  imagenId?: string;
  ampliacionId?: string;
  siniestroId: string;
  aseguradoId: string;
  archivo: Buffer;
  tipoMime: string;
  capturadaEn: string;
  latitud: number | null;
  longitud: number | null;
  precisionGpsM: number | null;
  orden: number;
  rostrosDifuminados: boolean;
  userAgent: string | null;
};

/**
 * Sube una evidencia de un siniestro:
 * - el siniestro debe existir y pertenecer al asegurado;
 * - solo JPEG, máximo 1.5 MB y 5 imágenes por siniestro;
 * - rechaza archivos con EXIF de cámara (captura no en vivo);
 * - calcula el dHash y guarda en Storage + BD.
 */
export async function uploadImage(
  deps: {
    repositorio: ClaimRepository;
    almacen: StorageService;
    imagenes: ImageService;
    auditoria?: AuditRepository;
  },
  input: SubirImagenInput,
): Promise<ImagenSiniestro> {
  const siniestro = await deps.repositorio.obtenerSiniestroPorId(input.siniestroId);
  if (!siniestro) {
    throw new AppError('SINIESTRO_NO_ENCONTRADO', 404, 'El siniestro no existe');
  }
  if (siniestro.aseguradoId !== input.aseguradoId) {
    throw new AppError('SINIESTRO_AJENO', 403, 'El siniestro no te pertenece');
  }
  let prefijo = `${input.siniestroId}/`;
  if (input.ampliacionId && deps.auditoria) {
    const solicitud = await getAmendment(
      { repositorio: deps.repositorio, auditoria: deps.auditoria },
      siniestro.id,
    );
    if (
      !solicitud ||
      solicitud.id !== input.ampliacionId ||
      solicitud.entregada ||
      siniestro.estado !== 'EN_REVISION' ||
      siniestro.analisisEstado === 'EN_PROCESO'
    )
      throw new AppError('ESTADO_INVALIDO', 409, 'La ampliación no admite más fotos');
    prefijo += `ampliaciones/${solicitud.id}/`;
  } else if (siniestro.estado !== 'PENDIENTE' || siniestro.analisisEstado !== 'NO_INICIADO') {
    throw new AppError('ESTADO_INVALIDO', 409, 'El siniestro ya fue analizado');
  }

  if (input.tipoMime !== 'image/jpeg') {
    throw new AppError('TIPO_ARCHIVO_INVALIDO', 415, 'Solo se aceptan imágenes JPEG');
  }
  if (input.archivo.byteLength > MAX_BYTES_IMAGEN) {
    throw new AppError(
      'ARCHIVO_DEMASIADO_GRANDE',
      413,
      `La imagen supera ${MAX_BYTES_IMAGEN} bytes`,
    );
  }

  const existentes = await deps.repositorio.listarImagenes(input.siniestroId);
  const repetida = input.imagenId ? existentes.find((i) => i.id === input.imagenId) : undefined;
  if (repetida) {
    if (!repetida.storagePath.startsWith(prefijo)) throw new AppError('SOLICITUD_CONFLICTIVA', 409);
    if (!(await deps.almacen.descargar(repetida.storagePath)).equals(input.archivo))
      throw new AppError('SOLICITUD_CONFLICTIVA', 409, 'El identificador ya pertenece a otra foto');
    return repetida;
  }
  const cantidadActual = input.ampliacionId
    ? existentes.filter((i) => i.storagePath.startsWith(prefijo)).length
    : await deps.repositorio.contarImagenes(input.siniestroId);
  if (cantidadActual >= MAX_IMAGENES) {
    throw new AppError('LIMITE_IMAGENES', 409, `Máximo ${MAX_IMAGENES} imágenes por siniestro`);
  }

  if (await deps.imagenes.esArchivoNoEnVivo(input.archivo)) {
    throw new AppError(
      'ARCHIVO_NO_EN_VIVO',
      422,
      'La imagen debe capturarse en vivo con la cámara',
    );
  }

  const imagenId = input.imagenId ?? crypto.randomUUID();
  const hashPerceptual = await deps.imagenes.calcularDHash(input.archivo);
  const camino = `${prefijo}${imagenId}.jpg`;

  try {
    await deps.almacen.subir({ camino, contenido: input.archivo, tipoMime: 'image/jpeg' });
  } catch (error) {
    // La carga pudo confirmarse aunque se perdiera su respuesta. Recuperar solo
    // si el contenido almacenado coincide byte por byte; nunca sobrescribirlo.
    let guardada: Buffer;
    try {
      guardada = await deps.almacen.descargar(camino);
    } catch {
      throw error;
    }
    if (!guardada.equals(input.archivo))
      throw new AppError('SOLICITUD_CONFLICTIVA', 409, 'El identificador ya pertenece a otra foto');
  }

  try {
    const registrar =
      deps.repositorio.registrarImagenAtomica?.bind(deps.repositorio) ??
      deps.repositorio.crearImagen.bind(deps.repositorio);
    return await registrar(
      {
        id: imagenId,
        siniestroId: input.siniestroId,
        storagePath: camino,
        hashPerceptual,
        capturadaEn: input.capturadaEn,
        latitud: input.latitud,
        longitud: input.longitud,
        precisionGpsM: input.precisionGpsM,
        userAgent: input.userAgent,
        orden: input.orden,
        rostrosDifuminados: input.rostrosDifuminados,
      },
      input.ampliacionId,
    );
  } catch (error) {
    // Una respuesta perdida puede ocultar una confirmación ya realizada.
    // Nunca borrar el archivo de una fila que sí quedó registrada.
    try {
      const confirmada = (await deps.repositorio.listarImagenes(input.siniestroId)).find(
        (i) => i.id === imagenId,
      );
      if (confirmada) return confirmada;
    } catch {
      throw new AppError(
        'EVIDENCIA_LIMPIEZA_PENDIENTE',
        502,
        'No se pudo comprobar si la foto quedó guardada. Recarga el caso antes de reintentar.',
      );
    }
    try {
      await deps.almacen.eliminar(camino);
    } catch {
      throw new AppError(
        'EVIDENCIA_LIMPIEZA_PENDIENTE',
        502,
        'No se pudo registrar la evidencia y su limpieza requiere revisión',
      );
    }
    throw error;
  }
}
