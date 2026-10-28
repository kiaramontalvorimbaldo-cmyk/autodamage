import { describe, expect, it } from 'vitest';
import { calcularCostos } from '@/domain/cost/cost';
import { triage } from '@/domain/triage/triage';
import type { Accion, Severidad } from '@/domain/types';

type EntradaBaremoDemo = {
  costo_repuesto_base: number;
  horas_mano_obra: number;
  costo_hora_mo: number;
};

const BAREMO_DEMO: Record<string, EntradaBaremoDemo> = {
  FARO_DEL_IZQ: { costo_repuesto_base: 120, horas_mano_obra: 1.0, costo_hora_mo: 30 },
  PUERTA_DEL_DER: { costo_repuesto_base: 300, horas_mano_obra: 3.5, costo_hora_mo: 30 },
  ESPEJO_DER: { costo_repuesto_base: 60, horas_mano_obra: 0.5, costo_hora_mo: 30 },
  CAPO: { costo_repuesto_base: 260, horas_mano_obra: 3.0, costo_hora_mo: 30 },
};

function mapaBaremoDemo(): Map<string, EntradaBaremoDemo> {
  return new Map(Object.entries(BAREMO_DEMO));
}

describe('seed-demo: caso VERDE (faro delantero izquierdo)', () => {
  it('debería producir ruta VERDE con estado FAST_TRACK', () => {
    const piezas = [{ codigo_pieza: 'FARO_DEL_IZQ', accion: 'SUSTITUIR' as Accion }];
    const costos = calcularCostos(piezas, mapaBaremoDemo());

    expect(costos.costoTotalUsd).toBe(150);
    expect(costos.piezasValidas).toBe(1);

    const decision = triage({
      severidad: 'LEVE' as Severidad,
      estructurales: { danoEstructural: false, airbags: false, perdidaTotal: false },
      costoTotalUsd: costos.costoTotalUsd,
      verdictFraude: 'SIN_RIESGO',
      confianzaGlobal: 0.91,
      iaDisponible: true,
      piezasValidas: costos.piezasValidas,
    });

    expect(decision.ruta).toBe('VERDE');
    expect(decision.estado).toBe('FAST_TRACK');
    expect(decision.requiereInspeccionPresencial).toBe(false);
  });
});

describe('seed-demo: caso AMARILLA (puerta delantera derecha + espejo)', () => {
  it('debería producir ruta AMARILLA con estado EN_REVISION', () => {
    const piezas = [
      { codigo_pieza: 'PUERTA_DEL_DER', accion: 'REPARAR' as Accion },
      { codigo_pieza: 'ESPEJO_DER', accion: 'SUSTITUIR' as Accion },
    ];
    const costos = calcularCostos(piezas, mapaBaremoDemo());

    expect(costos.costoTotalUsd).toBe(180);
    expect(costos.piezasValidas).toBe(2);

    const decision = triage({
      severidad: 'MODERADO' as Severidad,
      estructurales: { danoEstructural: false, airbags: false, perdidaTotal: false },
      costoTotalUsd: costos.costoTotalUsd,
      verdictFraude: 'SIN_RIESGO',
      confianzaGlobal: 0.82,
      iaDisponible: true,
      piezasValidas: costos.piezasValidas,
    });

    expect(decision.ruta).toBe('AMARILLA');
    expect(decision.estado).toBe('EN_REVISION');
    expect(decision.requiereInspeccionPresencial).toBe(false);
  });
});

describe('seed-demo: caso ROJA (daño estructural severo)', () => {
  it('debería producir ruta ROJA con inspección presencial', () => {
    const piezas = [{ codigo_pieza: 'CAPO', accion: 'SUSTITUIR' as Accion }];
    const costos = calcularCostos(piezas, mapaBaremoDemo());

    expect(costos.costoTotalUsd).toBe(350);
    expect(costos.piezasValidas).toBe(1);

    const decision = triage({
      severidad: 'SEVERO' as Severidad,
      estructurales: { danoEstructural: true, airbags: false, perdidaTotal: false },
      costoTotalUsd: costos.costoTotalUsd,
      verdictFraude: 'SIN_RIESGO',
      confianzaGlobal: 0.93,
      iaDisponible: true,
      piezasValidas: costos.piezasValidas,
    });

    expect(decision.ruta).toBe('ROJA');
    expect(decision.estado).toBe('EN_REVISION');
    expect(decision.requiereInspeccionPresencial).toBe(true);
    expect(decision.tipoInspeccion).toBe('PRESENCIAL');
  });
});
