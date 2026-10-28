import type { Accion } from '@/domain/types';

/**
 * Pieza tal como la ve el perito (datos de la evaluación
 * de daños + metadatos para la interfaz).
 */
export type PiezaVista = {
  imagenId?: string | null;
  evaluacionId: string;
  codigoPieza: string;
  accionRequerida: Accion;
  costoPiezaEstimado: number;
  confianza: number | null;
  bbox: readonly [number, number, number, number] | null;
  aprobadoPorPerito: boolean;
  observacionPieza: string | null;
};

/** Suma los costos de las piezas (para el total editable). */
export function sumarCostos(piezas: readonly PiezaVista[]): number {
  return Math.round(piezas.reduce((suma, p) => suma + p.costoPiezaEstimado, 0) * 100) / 100;
}
