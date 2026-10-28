import type { EntradaBaremo } from '@/domain/cost/cost';

/**
 * Puerto del repositorio del baremo de costos.
 */
export interface BaremoRepository {
  /** Mapa codigo_pieza → entrada del baremo. */
  obtenerTodo(): Promise<Map<string, EntradaBaremo>>;
}
