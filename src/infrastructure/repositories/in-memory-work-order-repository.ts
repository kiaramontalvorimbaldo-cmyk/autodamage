import type { Orden, Taller } from '@/domain/entities';
import type {
  CrearOrdenInput,
  WorkOrderRepository,
} from '@/application/ports/work-order-repository';
import type { EstadoOrden } from '@/domain/types';

const ESTADOS_ABIERTOS: EstadoOrden[] = ['EMITIDA', 'RECIBIDO', 'EN_REPARACION'];

/** WorkOrderRepository en memoria para pruebas. */
export class InMemoryWorkOrderRepository implements WorkOrderRepository {
  private talleres = new Map<string, Taller>();
  private ordenes = new Map<string, Orden>();
  private secuencia = 0;

  agregarTaller(taller: Taller): void {
    this.talleres.set(taller.id, taller);
  }

  private id(): string {
    this.secuencia += 1;
    return `00000000-0000-0000-0001${String(this.secuencia).padStart(3, '0')}`;
  }

  async listarTalleres(): Promise<Taller[]> {
    return [...this.talleres.values()];
  }

  async obtenerTallerPorId(id: string): Promise<Taller | null> {
    return this.talleres.get(id) ?? null;
  }

  async obtenerTallerPorUsuario(usuarioId: string): Promise<Taller | null> {
    return [...this.talleres.values()].find((t) => t.usuarioId === usuarioId) ?? null;
  }

  async contarOrdenesAbiertas(tallerId: string): Promise<number> {
    return [...this.ordenes.values()].filter(
      (o) => o.tallerId === tallerId && ESTADOS_ABIERTOS.includes(o.estado),
    ).length;
  }

  async ordenAbiertaMasAntigua(tallerId: string): Promise<Date | null> {
    const fechas = [...this.ordenes.values()]
      .filter((o) => o.tallerId === tallerId && ESTADOS_ABIERTOS.includes(o.estado))
      .map((o) => new Date(o.creadoEn).getTime());
    if (fechas.length === 0) return null;
    return new Date(Math.min(...fechas));
  }

  async crearOrden(input: CrearOrdenInput): Promise<Orden> {
    const ahora = new Date().toISOString();
    const orden: Orden = {
      id: this.id(),
      siniestroId: input.siniestroId,
      tallerId: input.tallerId,
      estado: 'EMITIDA',
      montoAutorizado: input.montoAutorizado,
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
    this.ordenes.set(orden.id, orden);
    return orden;
  }

  async obtenerOrdenPorSiniestro(siniestroId: string): Promise<Orden | null> {
    return [...this.ordenes.values()].find((o) => o.siniestroId === siniestroId) ?? null;
  }

  async obtenerOrdenPorId(id: string): Promise<Orden | null> {
    return this.ordenes.get(id) ?? null;
  }

  async listarOrdenesPorTaller(tallerId: string, estado?: EstadoOrden): Promise<Orden[]> {
    return [...this.ordenes.values()].filter(
      (o) => o.tallerId === tallerId && (!estado || o.estado === estado),
    );
  }

  async listarTodasLasOrdenes(estado?: EstadoOrden): Promise<Orden[]> {
    return [...this.ordenes.values()].filter((o) => !estado || o.estado === estado);
  }

  async actualizarEstadoOrden(id: string, estado: EstadoOrden): Promise<void> {
    const orden = this.ordenes.get(id);
    if (!orden) throw new Error(`Orden no encontrada: ${id}`);
    this.ordenes.set(id, {
      ...orden,
      estado,
      actualizadoEn: new Date().toISOString(),
    });
  }
}
