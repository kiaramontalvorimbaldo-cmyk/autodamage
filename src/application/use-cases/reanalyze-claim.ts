import { AppError } from '@/lib/errors';
import type { AnalizarClaimDeps } from './analyze-claim';

/**
 * Valida y prepara el reanálisis de IA de un siniestro degradado
 * (etiqueta IA_NO_DISPONIBLE o analisis_estado = FALLIDO).
 * Las inspecciones previas se conservan para auditoría.
 * Reserva EN_PROCESO; el llamante ejecuta `analyzeClaim` después (p. ej. con after()).
 */
export async function reanalyzeClaim(
  deps: Pick<AnalizarClaimDeps, 'repositorio' | 'auditoria'>,
  siniestroId: string,
  peritoId: string,
): Promise<void> {
  const siniestro = await deps.repositorio.obtenerSiniestroPorId(siniestroId);
  if (!siniestro) throw new AppError('SINIESTRO_NO_ENCONTRADO', 404);

  if (
    siniestro.analisisEstado === 'EN_PROCESO' ||
    !['PENDIENTE', 'EN_REVISION'].includes(siniestro.estado)
  ) {
    throw new AppError(
      'REANALISIS_NO_PERMITIDO',
      409,
      'El siniestro ya está en proceso o tiene una decisión final',
    );
  }

  const degradado =
    siniestro.analisisEstado === 'FALLIDO' ||
    siniestro.etiquetas.includes('IA_NO_DISPONIBLE') ||
    siniestro.etiquetas.includes('AMPLIACION_RECIBIDA');
  if (!degradado) {
    throw new AppError(
      'REANALISIS_NO_PERMITIDO',
      409,
      'Solo se puede reanalizar un caso fallido, sin IA disponible o con una ampliación recibida',
    );
  }

  if ((await deps.repositorio.contarImagenes(siniestroId)) === 0)
    throw new AppError('SIN_IMAGENES', 409);
  if (
    !(await deps.repositorio.reservarAnalisis(
      siniestroId,
      siniestro.analisisEstado,
      siniestro.estado,
    ))
  ) {
    throw new AppError('REANALISIS_NO_PERMITIDO', 409, 'Otra solicitud ya inició el análisis');
  }

  try {
    await deps.auditoria.registrar({
      entidad: 'siniestro',
      entidadId: siniestroId,
      accion: 'REANALISIS_SOLICITADO',
      actorTipo: 'USUARIO',
      actorId: peritoId,
    });
  } catch (error) {
    await deps.repositorio.actualizarSiniestro(siniestroId, { analisisEstado: 'FALLIDO' });
    throw error;
  }
}
