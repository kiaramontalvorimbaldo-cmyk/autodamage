import { describe, expect, it } from 'vitest';
import { calcularVerdictFraude, esCapturaInconsistente } from './verdict';

describe('calcularVerdictFraude', () => {
  it('SIN_RIESGO cuando no hay banderas', () => {
    const resultado = calcularVerdictFraude({
      sospechaRecaptura: false,
      fotoDuplicada: false,
      inconsistenciaGps: false,
      inconsistenciaTemporal: false,
    });
    expect(resultado).toEqual({ verdict: 'SIN_RIESGO', indicadores: [] });
  });

  it('prioridad: SOSPECHA_RECAPTURA gana sobre las demás', () => {
    const resultado = calcularVerdictFraude({
      sospechaRecaptura: true,
      fotoDuplicada: true,
      inconsistenciaGps: true,
      inconsistenciaTemporal: true,
    });
    expect(resultado.verdict).toBe('SOSPECHA_RECAPTURA');
    expect(resultado.indicadores).toEqual([
      'SOSPECHA_RECAPTURA',
      'FOTO_DUPLICADA',
      'INCONSISTENCIA_GPS',
      'INCONSISTENCIA_TEMPORAL',
    ]);
  });

  it('prioridad: FOTO_DUPLICADA > INCONSISTENCIA_GPS > INCONSISTENCIA_TEMPORAL', () => {
    const resultado = calcularVerdictFraude({
      sospechaRecaptura: false,
      fotoDuplicada: true,
      inconsistenciaGps: true,
      inconsistenciaTemporal: true,
    });
    expect(resultado.verdict).toBe('FOTO_DUPLICADA');
    expect(resultado.indicadores).toEqual([
      'FOTO_DUPLICADA',
      'INCONSISTENCIA_GPS',
      'INCONSISTENCIA_TEMPORAL',
    ]);
  });

  it('prioridad: INCONSISTENCIA_GPS > INCONSISTENCIA_TEMPORAL', () => {
    const resultado = calcularVerdictFraude({
      sospechaRecaptura: false,
      fotoDuplicada: false,
      inconsistenciaGps: true,
      inconsistenciaTemporal: true,
    });
    expect(resultado.verdict).toBe('INCONSISTENCIA_GPS');
    expect(resultado.indicadores).toEqual(['INCONSISTENCIA_GPS', 'INCONSISTENCIA_TEMPORAL']);
  });

  it('solo temporal → INCONSISTENCIA_TEMPORAL', () => {
    const resultado = calcularVerdictFraude({
      sospechaRecaptura: false,
      fotoDuplicada: false,
      inconsistenciaGps: false,
      inconsistenciaTemporal: true,
    });
    expect(resultado.verdict).toBe('INCONSISTENCIA_TEMPORAL');
    expect(resultado.indicadores).toEqual(['INCONSISTENCIA_TEMPORAL']);
  });

  it('indicadores lista todas las que aplican aunque el veredicto sea una', () => {
    const resultado = calcularVerdictFraude({
      sospechaRecaptura: false,
      fotoDuplicada: false,
      inconsistenciaGps: true,
      inconsistenciaTemporal: true,
    });
    expect(resultado.indicadores).toHaveLength(2);
  });
});

describe('esCapturaInconsistente', () => {
  const recibida = new Date('2026-01-15T12:00:00.000Z');

  it('captura reciente es consistente', () => {
    const capturada = new Date('2026-01-15T11:55:00.000Z'); // 5 min antes
    expect(esCapturaInconsistente(capturada, recibida)).toBe(false);
  });

  it('captura exactamente en el límite (15 min) es consistente', () => {
    const capturada = new Date('2026-01-15T11:45:00.000Z'); // 15 min antes
    expect(esCapturaInconsistente(capturada, recibida)).toBe(false);
  });

  it('captura vieja (más de 15 min) es inconsistente', () => {
    const capturada = new Date('2026-01-15T11:44:59.000Z'); // 15 min 1 s antes
    expect(esCapturaInconsistente(capturada, recibida)).toBe(true);
  });

  it('captura 1 min en el futuro es consistente (tolerancia de reloj)', () => {
    const capturada = new Date('2026-01-15T12:00:30.000Z'); // 30 s después
    expect(esCapturaInconsistente(capturada, recibida)).toBe(false);
  });

  it('captura muy en el futuro es inconsistente', () => {
    const capturada = new Date('2026-01-15T12:02:00.000Z'); // 2 min después
    expect(esCapturaInconsistente(capturada, recibida)).toBe(true);
  });
});
