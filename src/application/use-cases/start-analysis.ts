import { AppError } from '@/lib/errors';
import type { ClaimRepository } from '../ports/claim-repository';

/** Autoriza y reserva un primer análisis antes de programar el trabajo. */
export async function startAnalysis(
  repositorio: ClaimRepository,
  id: string,
  usuarioId: string,
): Promise<void> {
  const siniestro = await repositorio.obtenerSiniestroPorId(id);
  if (!siniestro) throw new AppError('SINIESTRO_NO_ENCONTRADO', 404);
  if (siniestro.aseguradoId !== usuarioId) throw new AppError('SINIESTRO_AJENO', 403);
  if (siniestro.estado !== 'PENDIENTE' || siniestro.analisisEstado !== 'NO_INICIADO') {
    throw new AppError(
      'ANALISIS_NO_DISPONIBLE',
      409,
      'El análisis ya se inició o requiere revisión del perito',
    );
  }
  const cantidad = await repositorio.contarImagenes(id);
  if (cantidad === 0) throw new AppError('SIN_IMAGENES', 409);
  if (cantidad < 3)
    throw new AppError(
      'FOTOS_INSUFICIENTES',
      409,
      'Captura al menos 3 fotos antes de iniciar el análisis',
    );
  if (!(await repositorio.reservarAnalisis(id, 'NO_INICIADO', 'PENDIENTE'))) {
    throw new AppError('ANALISIS_NO_DISPONIBLE', 409, 'Otra solicitud ya inició el análisis');
  }
}
