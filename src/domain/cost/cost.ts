import { FACTOR_PINTURA } from '@/domain/config';
import { roundMoney } from '@/domain/money';
import type { Accion, Etiqueta } from '@/domain/types';

/** Entrada del baremo para una pieza (mapeada desde la BD). */
export type EntradaBaremo = {
  costo_repuesto_base: number;
  horas_mano_obra: number;
  costo_hora_mo: number;
};

/** Pieza detectada por la IA (solo código y acción; el costo lo calcula el sistema). */
export type PiezaDetectada = {
  codigo_pieza: string;
  accion: Accion;
};

export type PiezaConCosto = PiezaDetectada & {
  horas_mano_obra: number;
  costo_pieza_estimado: number;
};

export type ResultadoCosto = {
  piezas: PiezaConCosto[];
  costoTotalUsd: number;
  piezasValidas: number;
  codigosDesconocidos: string[];
  etiquetas: Etiqueta[];
};

/**
 * Costo de una pieza según la acción requerida:
 * - SUSTITUIR = repuesto base + mano de obra
 * - REPARAR   = mano de obra
 * - PINTAR    = FACTOR_PINTURA × mano de obra
 */
export function costoPieza(pieza: PiezaDetectada, baremo: EntradaBaremo): number {
  const manoObra = baremo.horas_mano_obra * baremo.costo_hora_mo;
  switch (pieza.accion) {
    case 'SUSTITUIR':
      return roundMoney(baremo.costo_repuesto_base + manoObra);
    case 'REPARAR':
      return roundMoney(manoObra);
    case 'PINTAR':
      return roundMoney(manoObra * FACTOR_PINTURA);
  }
}

/**
 * Calcula el costo total de un conjunto de piezas detectadas contra el baremo.
 * Las piezas con código fuera del baremo se descartan y se etiquetan
 * como CODIGOS_DESCONOCIDOS; si no queda ninguna válida → SIN_PIEZAS_VALIDAS.
 */
export function calcularCostos(
  piezas: PiezaDetectada[],
  baremo: Map<string, EntradaBaremo>,
): ResultadoCosto {
  const codigosDesconocidos: string[] = [];
  const piezasConCosto: PiezaConCosto[] = [];

  for (const pieza of piezas) {
    const entrada = baremo.get(pieza.codigo_pieza);
    if (!entrada) {
      if (!codigosDesconocidos.includes(pieza.codigo_pieza)) {
        codigosDesconocidos.push(pieza.codigo_pieza);
      }
      continue;
    }
    piezasConCosto.push({
      codigo_pieza: pieza.codigo_pieza,
      accion: pieza.accion,
      horas_mano_obra: entrada.horas_mano_obra,
      costo_pieza_estimado: costoPieza(pieza, entrada),
    });
  }

  const costoTotalUsd = roundMoney(
    piezasConCosto.reduce((suma, pieza) => suma + pieza.costo_pieza_estimado, 0),
  );

  const etiquetas: Etiqueta[] = [];
  if (codigosDesconocidos.length > 0) {
    etiquetas.push('CODIGOS_DESCONOCIDOS');
  }
  if (piezasConCosto.length === 0) {
    etiquetas.push('SIN_PIEZAS_VALIDAS');
  }

  return {
    piezas: piezasConCosto,
    costoTotalUsd,
    piezasValidas: piezasConCosto.length,
    codigosDesconocidos,
    etiquetas,
  };
}
