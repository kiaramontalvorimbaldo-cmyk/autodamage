import { AppError } from '@/lib/errors';
import { puedeTransicionarOrden } from '@/domain/claim-state/work-order-state';
import { puedeTransicionar } from '@/domain/claim-state/claim-state';
import type { ClaimRepository } from '../ports/claim-repository';
import type { WorkOrderRepository } from '../ports/work-order-repository';
import type { AuditRepository } from '../ports/audit-repository';
import type { EstadoOrden } from '@/domain/types';

export type UpdateWorkOrderDeps = {
  repositorio: ClaimRepository;
  ordenes: WorkOrderRepository;
  auditoria: AuditRepository;
};

export type EstadoOrdenPatch = Exclude<EstadoOrden, 'EMITIDA'>;

/**
 * Avanza la orden de trabajo (solo el taller dueño).
 * Al COMPLETADO, el siniestro pasa a FINALIZADO (vía la máquina de estados).
 */
export async function updateWorkOrder(
  deps: UpdateWorkOrderDeps,
  input: {
    ordenId: string;
    usuarioTaller: string;
    nuevoEstado: EstadoOrdenPatch;
  },
): Promise<void> {
  if (deps.ordenes.avanzarAtomico) {
    return deps.ordenes.avanzarAtomico(input.ordenId, input.usuarioTaller, input.nuevoEstado);
  }
  const orden = await deps.ordenes.obtenerOrdenPorId(input.ordenId);
  if (!orden) throw new AppError('ORDEN_NO_ENCONTRADA', 404);

  const taller = await deps.ordenes.obtenerTallerPorUsuario(input.usuarioTaller);
  if (!taller || taller.id !== orden.tallerId) {
    throw new AppError('SIN_PERMISO', 403, 'No eres el taller dueño de la orden');
  }

  const repetida = orden.estado === input.nuevoEstado;
  if (!repetida) puedeTransicionarOrden(orden.estado, input.nuevoEstado);

  const siniestro = await deps.repositorio.obtenerSiniestroPorId(orden.siniestroId);
  if (!siniestro) throw new AppError('SINIESTRO_NO_ENCONTRADO', 404);
  if (input.nuevoEstado === 'COMPLETADO' && siniestro.estado !== 'FINALIZADO') {
    puedeTransicionar(siniestro.estado, 'FINALIZADO', { rol: 'TALLER' });
  }

  if (!repetida) await deps.ordenes.actualizarEstadoOrden(orden.id, input.nuevoEstado);
  if (input.nuevoEstado === 'COMPLETADO') {
    await deps.repositorio.actualizarSiniestro(siniestro.id, {
      estado: 'FINALIZADO',
    });
  }

  if (repetida) return;
  await deps.auditoria.registrar({
    entidad: 'ordenes_trabajo',
    entidadId: orden.id,
    accion: 'ESTADO_ORDEN_ACTUALIZADO',
    actorTipo: 'USUARIO',
    actorId: input.usuarioTaller,
    datos: { estadoAnterior: orden.estado, estadoNuevo: input.nuevoEstado },
  });
}
