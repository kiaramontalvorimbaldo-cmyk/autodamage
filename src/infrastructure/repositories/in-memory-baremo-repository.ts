import type { BaremoRepository } from '@/application/ports/baremo-repository';
import type { EntradaBaremo } from '@/domain/cost/cost';

/**
 * Baremo en memoria para pruebas.
 */
export class InMemoryBaremoRepository implements BaremoRepository {
  private mapa: Map<string, EntradaBaremo>;

  constructor(entradas: Record<string, EntradaBaremo> = {}) {
    this.mapa = new Map(Object.entries(entradas));
  }

  async obtenerTodo(): Promise<Map<string, EntradaBaremo>> {
    return new Map(this.mapa);
  }

  /** Añade o sobrescribe una pieza (para configurar pruebas). */
  definir(codigoPieza: string, entrada: EntradaBaremo): void {
    this.mapa.set(codigoPieza, entrada);
  }
}
