import { describe, expect, it } from 'vitest';
import {
  metricasPiezas,
  metricasRecaptura,
  metricasSeveridad,
  percentil,
  type Etiqueta,
} from './metricas-evaluacion';

const reales: Etiqueta[] = [
  { archivo: 'a', severidad: 'LEVE', piezas: ['FARO_DEL_IZQ'], esRecaptura: false },
  { archivo: 'b', severidad: 'SEVERO', piezas: ['CAPO', 'PARAGOLPES_DEL'], esRecaptura: true },
  { archivo: 'c', severidad: 'MODERADO', piezas: ['PUERTA_DEL_IZQ'], esRecaptura: false },
];

describe('metricasSeveridad', () => {
  it('cuenta aciertos y matriz de confusión', () => {
    const m = metricasSeveridad(reales, [
      { severidad: 'LEVE', piezas: [], esRecaptura: false },
      { severidad: 'MODERADO', piezas: [], esRecaptura: true },
      { severidad: 'MODERADO', piezas: [], esRecaptura: false },
    ]);
    expect(m.aciertos).toBe(2);
    expect(m.total).toBe(3);
    expect(m.matriz.SEVERO.MODERADO).toBe(1);
  });
});

describe('metricasPiezas', () => {
  it('calcula precisión, exhaustividad y F1', () => {
    const m = metricasPiezas(reales, [
      { severidad: 'LEVE', piezas: ['FARO_DEL_IZQ', 'CAPO'], esRecaptura: false },
      { severidad: 'SEVERO', piezas: ['CAPO'], esRecaptura: true },
      { severidad: 'MODERADO', piezas: ['PUERTA_DEL_IZQ'], esRecaptura: false },
    ]);
    expect(m.precision).toBeCloseTo(3 / 4);
    expect(m.recall).toBeCloseTo(3 / 4);
    expect(m.f1).toBeCloseTo(0.75);
  });
});

describe('metricasRecaptura', () => {
  it('cuenta VP/FP/VN/FN', () => {
    const m = metricasRecaptura(reales, [
      { severidad: 'LEVE', piezas: [], esRecaptura: true },
      { severidad: 'SEVERO', piezas: [], esRecaptura: true },
      { severidad: 'MODERADO', piezas: [], esRecaptura: false },
    ]);
    expect(m).toEqual({ vp: 1, fp: 1, vn: 1, fn: 0 });
  });
});

describe('percentil', () => {
  it('calcula p50 y p95', () => {
    const valores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentil(valores, 50)).toBe(5);
    expect(percentil(valores, 95)).toBe(10);
    expect(percentil([], 50)).toBe(0);
  });
});
