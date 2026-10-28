import { describe, expect, it } from 'vitest';
import { triage, type TriageInput } from './triage';

const base: TriageInput = {
  severidad: 'LEVE',
  estructurales: { danoEstructural: false, airbags: false, perdidaTotal: false },
  costoTotalUsd: 150,
  verdictFraude: 'SIN_RIESGO',
  confianzaGlobal: 0.9,
  iaDisponible: true,
  piezasValidas: 1,
};

const casos: [string, Partial<TriageInput>, 'VERDE' | 'AMARILLA' | 'ROJA'][] = [
  ['LEVE, 150 USD, sin fraude, confianza 0.9', {}, 'VERDE'],
  ['LEVE, 499.99 USD (límite inferior estricto)', { costoTotalUsd: 499.99 }, 'VERDE'],
  ['LEVE, 500.00 USD (límite: no es estrictamente menor)', { costoTotalUsd: 500.0 }, 'AMARILLA'],
  ['LEVE, 600 USD', { costoTotalUsd: 600 }, 'AMARILLA'],
  ['MODERADO, 80 USD', { severidad: 'MODERADO', costoTotalUsd: 80 }, 'AMARILLA'],
  [
    'MODERADO, 10 USD, confianza alta',
    { severidad: 'MODERADO', costoTotalUsd: 10, confianzaGlobal: 0.99 },
    'AMARILLA',
  ],
  ['SEVERO, 10 USD', { severidad: 'SEVERO', costoTotalUsd: 10 }, 'ROJA'],
  [
    'LEVE + daño estructural',
    { estructurales: { danoEstructural: true, airbags: false, perdidaTotal: false } },
    'ROJA',
  ],
  [
    'LEVE + airbags',
    { estructurales: { danoEstructural: false, airbags: true, perdidaTotal: false } },
    'ROJA',
  ],
  [
    'LEVE + pérdida total',
    { estructurales: { danoEstructural: false, airbags: false, perdidaTotal: true } },
    'ROJA',
  ],
  ['LEVE + SOSPECHA_RECAPTURA', { verdictFraude: 'SOSPECHA_RECAPTURA' }, 'ROJA'],
  ['LEVE + FOTO_DUPLICADA', { verdictFraude: 'FOTO_DUPLICADA' }, 'ROJA'],
  ['LEVE + INCONSISTENCIA_GPS', { verdictFraude: 'INCONSISTENCIA_GPS' }, 'ROJA'],
  ['LEVE + INCONSISTENCIA_TEMPORAL', { verdictFraude: 'INCONSISTENCIA_TEMPORAL' }, 'ROJA'],
  ['LEVE, confianza 0.59', { confianzaGlobal: 0.59 }, 'AMARILLA'],
  ['LEVE, confianza 0.6 (límite: no es menor que el mínimo)', { confianzaGlobal: 0.6 }, 'VERDE'],
  ['IA no disponible', { iaDisponible: false }, 'AMARILLA'],
  ['0 piezas válidas', { piezasValidas: 0 }, 'AMARILLA'],
  [
    'LEVE, confianza 0.59 + IA no disponible',
    { confianzaGlobal: 0.59, iaDisponible: false },
    'AMARILLA',
  ],
  ['0 piezas válidas + confianza 0.59', { piezasValidas: 0, confianzaGlobal: 0.59 }, 'AMARILLA'],
  ['SEVERO con costo bajo gana la severidad', { severidad: 'SEVERO', costoTotalUsd: 5 }, 'ROJA'],
  [
    'LEVE, 499.99 USD, confianza 0.6, todo ok',
    { costoTotalUsd: 499.99, confianzaGlobal: 0.6 },
    'VERDE',
  ],
];

describe('triage', () => {
  it.each(casos)('%s → %s', (_nombre, cambios, rutaEsperada) => {
    const resultado = triage({ ...base, ...cambios });
    expect(resultado.ruta).toBe(rutaEsperada);
  });

  it('VERDE implica FAST_TRACK, inspección digital y sin presencial', () => {
    const resultado = triage(base);
    expect(resultado.estado).toBe('FAST_TRACK');
    expect(resultado.tipoInspeccion).toBe('DIGITAL_IA');
    expect(resultado.requiereInspeccionPresencial).toBe(false);
    expect(resultado.etiquetas).toEqual([]);
    expect(resultado.razones.length).toBeGreaterThan(0);
  });

  it('ROJA implica EN_REVISION, presencial y tipo PRESENCIAL', () => {
    const resultado = triage({
      ...base,
      estructurales: { danoEstructural: true, airbags: false, perdidaTotal: false },
    });
    expect(resultado.estado).toBe('EN_REVISION');
    expect(resultado.tipoInspeccion).toBe('PRESENCIAL');
    expect(resultado.requiereInspeccionPresencial).toBe(true);
  });

  it('AMARILLA por IA no disponible lleva etiqueta IA_NO_DISPONIBLE', () => {
    const resultado = triage({ ...base, iaDisponible: false });
    expect(resultado.estado).toBe('EN_REVISION');
    expect(resultado.etiquetas).toContain('IA_NO_DISPONIBLE');
  });

  it('AMARILLA por 0 piezas válidas lleva etiqueta SIN_PIEZAS_VALIDAS', () => {
    const resultado = triage({ ...base, piezasValidas: 0 });
    expect(resultado.etiquetas).toContain('SIN_PIEZAS_VALIDAS');
  });

  it('AMARILLA por baja confianza lleva etiqueta BAJA_CONFIANZA', () => {
    const resultado = triage({ ...base, confianzaGlobal: 0.59 });
    expect(resultado.etiquetas).toContain('BAJA_CONFIANZA');
  });

  it('AMARILLA por MODERADO no lleva etiquetas de degradación', () => {
    const resultado = triage({ ...base, severidad: 'MODERADO' });
    expect(resultado.estado).toBe('EN_REVISION');
    expect(resultado.etiquetas).toEqual([]);
    expect(resultado.razones).toContain('severidad MODERADA');
  });

  it('acumula varias etiquetas cuando concurren causas', () => {
    const resultado = triage({
      ...base,
      iaDisponible: false,
      piezasValidas: 0,
      confianzaGlobal: 0.1,
    });
    expect(resultado.etiquetas).toEqual(
      expect.arrayContaining(['IA_NO_DISPONIBLE', 'SIN_PIEZAS_VALIDAS', 'BAJA_CONFIANZA']),
    );
  });

  it('ninguna combinación produce RECHAZADO (solo FAST_TRACK o EN_REVISION)', () => {
    for (const [, cambios] of casos) {
      const resultado = triage({ ...base, ...cambios });
      expect(['FAST_TRACK', 'EN_REVISION']).toContain(resultado.estado);
    }
  });

  it('la ROJA tiene razones explicando la causa', () => {
    const resultado = triage({ ...base, verdictFraude: 'SOSPECHA_RECAPTURA' });
    expect(resultado.razones.join(' ')).toMatch(/SOSPECHA_RECAPTURA/);
  });
});
