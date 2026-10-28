import type { Orden, Taller } from '@/domain/entities';
import type { EstadoOrden } from '@/domain/types';

export type CrearOrdenInput = {
  siniestroId: string;
  tallerId: string;
  montoAutorizado: number;
};

/**
 * Puerto de órdenes de trabajo y talleres.
 */
export interface WorkOrderRepository {
  emitirAtomico?(
    siniestroId: string,
    actorTipo: 'USUARIO' | 'SISTEMA',
    actorId: string | null,
  ): Promise<Orden | null>;
  avanzarAtomico?(ordenId: string, usuarioId: string, estado: EstadoOrden): Promise<void>;
  listarTalleres(): Promise<Taller[]>;
  obtenerTallerPorId(id: string): Promise<Taller | null>;
  obtenerTallerPorUsuario(usuarioId: string): Promise<Taller | null>;
  /** Órdenes activas (EMITIDA, RECIBIDO, EN_REPARACION) de un taller. */
  contarOrdenesAbiertas(tallerId: string): Promise<number>;
  /** Fecha de la orden abierta más antigua de un taller (null si no hay). */
  ordenAbiertaMasAntigua(tallerId: string): Promise<Date | null>;
  crearOrden(input: CrearOrdenInput): Promise<Orden>;
  obtenerOrdenPorSiniestro(siniestroId: string): Promise<Orden | null>;
  obtenerOrdenPorId(id: string): Promise<Orden | null>;
  listarOrdenesPorTaller(tallerId: string, estado?: EstadoOrden): Promise<Orden[]>;
  listarTodasLasOrdenes(estado?: EstadoOrden): Promise<Orden[]>;
  actualizarEstadoOrden(id: string, estado: EstadoOrden): Promise<void>;
}
