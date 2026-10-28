import { AppError } from '@/lib/errors';
import { assignWorkshop } from '@/domain/workshop/assign-workshop';
import type { ClaimRepository } from '../ports/claim-repository';
import type { WorkOrderRepository } from '../ports/work-order-repository';
import type { AuditRepository } from '../ports/audit-repository';
import type { Orden } from '@/domain/entities';

export type IssueWorkOrderDeps = {
  repositorio: ClaimRepository;
  ordenes: WorkOrderRepository;
  auditoria: AuditRepository;
};

/**
 * Crea la orden de trabajo de un siniestro (idempotente):
 * - Ruta VERDE tras el análisis, o APROBADO tras el dictamen.
 * - Elige el taller con `assignWorkshop` (error → EN_REVISION + auditoría).
 * - `monto_autorizado` = costo_total_estimado de la inspección.
 * - Si ya existe una orden para el siniestro, la devuelve (no duplica).
 */
export async function issueWorkOrder(
  deps: IssueWorkOrderDeps,
  siniestroId: string,
  actorTipo: 'USUARIO' | 'SISTEMA' = 'SISTEMA',
  actorId: string | null = null,
): Promise<Orden | null> {
  if (deps.ordenes.emitirAtomico)
    return deps.ordenes.emitirAtomico(siniestroId, actorTipo, actorId);
  const existente = await deps.ordenes.obtenerOrdenPorSiniestro(siniestroId);
  if (existente) return existente;

  const siniestro = await deps.repositorio.obtenerSiniestroPorId(siniestroId);
  if (!siniestro) throw new AppError('SINIESTRO_NO_ENCONTRADO', 404);

  const inspeccion = await deps.repositorio.obtenerInspeccionPorSiniestro(siniestroId);
  if (!inspeccion || inspeccion.costoTotalEstimado === null) {
    throw new AppError('SIN_COSTO_ESTIMADO', 409, 'El siniestro no tiene costo estimado');
  }
  const aprobado = siniestro.estado === 'APROBADO' || inspeccion.dictamenFinal === 'APROBADO';
  const viaRapida = siniestro.ruta === 'VERDE' && !inspeccion.dictamenFinal;
  if (
    !['FAST_TRACK', 'APROBADO', 'EN_REVISION'].includes(siniestro.estado) ||
    !(aprobado || viaRapida)
  )
    throw new AppError(
      'ESTADO_INVALIDO',
      409,
      'No se puede emitir una orden sin aprobación o vía rápida',
    );

  const talleres = await deps.ordenes.listarTalleres();
  const candidatos = await Promise.all(
    talleres.map(async (t) => ({
      id: t.id,
      activo: t.activo,
      ordenesAbiertas: await deps.ordenes.contarOrdenesAbiertas(t.id),
      ordenAbiertaMasAntigua: await deps.ordenes.ordenAbiertaMasAntigua(t.id),
    })),
  );

  let tallerId: string;
  try {
    tallerId = assignWorkshop(candidatos);
  } catch (e) {
    if (e instanceof AppError && e.code === 'SIN_TALLERES_DISPONIBLES') {
      await deps.auditoria.registrar({
        entidad: 'siniestros',
        entidadId: siniestroId,
        accion: 'SIN_TALLERES_DISPONIBLES',
        actorTipo,
        actorId,
        datos: { ruta: siniestro.ruta ?? null },
      });
      await deps.repositorio.actualizarSiniestro(siniestroId, {
        estado: 'EN_REVISION',
      });
      return null;
    }
    throw e;
  }

  const orden = await deps.ordenes.crearOrden({
    siniestroId,
    tallerId,
    montoAutorizado: inspeccion.costoTotalEstimado,
  });
  if (siniestro.estado === 'EN_REVISION')
    await deps.repositorio.actualizarSiniestro(siniestroId, {
      estado: aprobado ? 'APROBADO' : 'FAST_TRACK',
    });

  await deps.auditoria.registrar({
    entidad: 'ordenes_trabajo',
    entidadId: orden.id,
    accion: 'ORDEN_EMITIDA',
    actorTipo,
    actorId,
    datos: {
      siniestroId,
      tallerId,
      montoAutorizado: orden.montoAutorizado,
    },
  });

  return orden;
}
