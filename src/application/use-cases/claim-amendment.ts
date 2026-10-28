import { AppError } from '@/lib/errors';
import type { ClaimRepository } from '../ports/claim-repository';
import type { AuditRepository } from '../ports/audit-repository';

export type AmendmentDeps = { repositorio: ClaimRepository; auditoria: AuditRepository };
export type Ampliacion = {
  id: string;
  observaciones: string;
  entregada: boolean;
  cantidadFotos: number;
};
export async function getAmendment(
  deps: AmendmentDeps,
  siniestroId: string,
): Promise<Ampliacion | null> {
  const inspeccion = await deps.repositorio.obtenerInspeccionPorSiniestro(siniestroId);
  if (inspeccion?.dictamenFinal !== 'AMPLIACION_REQUERIDA') return null;
  const registros = [
    ...(await deps.auditoria.listarPorEntidad('siniestros', siniestroId)),
    ...(await deps.auditoria.listarPorEntidad('siniestro', siniestroId)),
  ].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
  const solicitud = registros.filter((r) => r.accion === 'DICTAMEN_REGISTRADO').at(-1);
  if (!solicitud) return null;
  const entregada = registros.some(
    (r) =>
      r.accion === 'AMPLIACION_ENTREGADA' &&
      typeof r.datos === 'object' &&
      r.datos !== null &&
      'ampliacionId' in r.datos &&
      r.datos.ampliacionId === solicitud.id,
  );
  const fotos = await deps.repositorio.listarImagenes(siniestroId);
  return {
    id: solicitud.id,
    observaciones: inspeccion.observacionesPerito ?? '',
    entregada,
    cantidadFotos: fotos.filter((f) => f.storagePath.includes(`/ampliaciones/${solicitud.id}/`))
      .length,
  };
}
export async function submitAmendment(
  deps: AmendmentDeps,
  id: string,
  usuarioId: string,
  ampliacionId: string,
): Promise<void> {
  const caso = await deps.repositorio.obtenerSiniestroPorId(id);
  if (!caso) throw new AppError('SINIESTRO_NO_ENCONTRADO', 404);
  if (caso.aseguradoId !== usuarioId) throw new AppError('SINIESTRO_AJENO', 403);
  const solicitud = await getAmendment(deps, id);
  if (
    !solicitud ||
    solicitud.id !== ampliacionId ||
    caso.estado !== 'EN_REVISION' ||
    caso.analisisEstado === 'EN_PROCESO'
  )
    throw new AppError(
      'ESTADO_INVALIDO',
      409,
      'La solicitud de ampliación cambió; recarga el caso',
    );
  if (solicitud.entregada) return;
  if (solicitud.cantidadFotos < 1)
    throw new AppError('SIN_IMAGENES', 409, 'Captura al menos una foto de ampliación');
  if (deps.repositorio.entregarAmpliacionAtomica)
    return deps.repositorio.entregarAmpliacionAtomica(id, usuarioId, ampliacionId);
  await deps.auditoria.registrar({
    entidad: 'siniestros',
    entidadId: id,
    accion: 'AMPLIACION_ENTREGADA',
    actorTipo: 'USUARIO',
    actorId: usuarioId,
    datos: { ampliacionId, cantidadFotos: solicitud.cantidadFotos },
  });
  await deps.repositorio.actualizarSiniestro(id, {
    etiquetas: [...new Set([...caso.etiquetas, 'AMPLIACION_RECIBIDA' as const])],
  });
}
