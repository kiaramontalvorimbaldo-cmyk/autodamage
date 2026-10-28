import { describe, expect, it } from 'vitest';
import { calcularCostos, costoPieza, type EntradaBaremo, type PiezaDetectada } from './cost';

const baremo = new Map<string, EntradaBaremo>([
  ['FARO_DEL_IZQ', { costo_repuesto_base: 120, horas_mano_obra: 1.0, costo_hora_mo: 30 }],
  ['PARAGOLPES_DEL', { costo_repuesto_base: 180, horas_mano_obra: 2.5, costo_hora_mo: 30 }],
  ['ESPEJO_IZQ', { costo_repuesto_base: 60, horas_mano_obra: 0.5, costo_hora_mo: 30 }],
]);

describe('costoPieza', () => {
  it('SUSTITUIR = repuesto base + horas × costo hora MO', () => {
    const pieza: PiezaDetectada = { codigo_pieza: 'FARO_DEL_IZQ', accion: 'SUSTITUIR' };
    expect(costoPieza(pieza, baremo.get('FARO_DEL_IZQ')!)).toBe(150.0);
  });

  it('REPARAR = horas × costo hora MO', () => {
    const pieza: PiezaDetectada = { codigo_pieza: 'FARO_DEL_IZQ', accion: 'REPARAR' };
    expect(costoPieza(pieza, baremo.get('FARO_DEL_IZQ')!)).toBe(30.0);
  });

  it('PINTAR = FACTOR_PINTURA × horas × costo hora MO', () => {
    const pieza: PiezaDetectada = { codigo_pieza: 'FARO_DEL_IZQ', accion: 'PINTAR' };
    expect(costoPieza(pieza, baremo.get('FARO_DEL_IZQ')!)).toBe(18.0);
  });

  it('redondea a 2 decimales', () => {
    const entrada: EntradaBaremo = {
      costo_repuesto_base: 0,
      horas_mano_obra: 1.111,
      costo_hora_mo: 3,
    };
    const pieza: PiezaDetectada = { codigo_pieza: 'X', accion: 'REPARAR' };
    // 1.111 × 3 = 3.333 → 3.33
    expect(costoPieza(pieza, entrada)).toBe(3.33);
  });
});

describe('calcularCostos', () => {
  it('suma el costo de varias piezas', () => {
    const resultado = calcularCostos(
      [
        { codigo_pieza: 'FARO_DEL_IZQ', accion: 'SUSTITUIR' },
        { codigo_pieza: 'PARAGOLPES_DEL', accion: 'REPARAR' },
      ],
      baremo,
    );
    // FARO SUSTITUIR: 120 + 1.0×30 = 150
    // PARAGOLPES REPARAR: 2.5×30 = 75
    expect(resultado.costoTotalUsd).toBe(225.0);
    expect(resultado.piezasValidas).toBe(2);
    expect(resultado.etiquetas).toEqual([]);
  });

  it('ejemplo del baremo: FARO_DEL_IZQ + SUSTITUIR = 150.00', () => {
    const resultado = calcularCostos(
      [{ codigo_pieza: 'FARO_DEL_IZQ', accion: 'SUSTITUIR' }],
      baremo,
    );
    expect(resultado.costoTotalUsd).toBe(150.0);
    expect(resultado.piezas[0].horas_mano_obra).toBe(1.0);
  });

  it('descarta códigos que no existen en el baremo y etiqueta CODIGOS_DESCONOCIDOS', () => {
    const resultado = calcularCostos(
      [
        { codigo_pieza: 'FARO_DEL_IZQ', accion: 'SUSTITUIR' },
        { codigo_pieza: 'PIZA_INVENTADA', accion: 'REPARAR' },
      ],
      baremo,
    );
    expect(resultado.piezasValidas).toBe(1);
    expect(resultado.codigosDesconocidos).toEqual(['PIZA_INVENTADA']);
    expect(resultado.etiquetas).toEqual(['CODIGOS_DESCONOCIDOS']);
    expect(resultado.costoTotalUsd).toBe(150.0);
  });

  it('etiqueta SIN_PIEZAS_VALIDAS (y CODIGOS_DESCONOCIDOS) cuando ninguna pieza es válida', () => {
    const resultado = calcularCostos([{ codigo_pieza: 'NO_EXISTE', accion: 'SUSTITUIR' }], baremo);
    expect(resultado.piezasValidas).toBe(0);
    expect(resultado.costoTotalUsd).toBe(0);
    expect(resultado.etiquetas).toEqual(['CODIGOS_DESCONOCIDOS', 'SIN_PIEZAS_VALIDAS']);
  });

  it('no duplica códigos desconocidos repetidos', () => {
    const resultado = calcularCostos(
      [
        { codigo_pieza: 'NO_EXISTE', accion: 'SUSTITUIR' },
        { codigo_pieza: 'NO_EXISTE', accion: 'REPARAR' },
      ],
      baremo,
    );
    expect(resultado.codigosDesconocidos).toEqual(['NO_EXISTE']);
  });

  it('lista vacía produce costo 0 y SIN_PIEZAS_VALIDAS', () => {
    const resultado = calcularCostos([], baremo);
    expect(resultado.costoTotalUsd).toBe(0);
    expect(resultado.piezasValidas).toBe(0);
    expect(resultado.etiquetas).toEqual(['SIN_PIEZAS_VALIDAS']);
  });
});
