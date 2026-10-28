import { describe, it, expect } from 'vitest';
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
describe('revisión humana tras ampliar evidencias', () => {
  it('debería evitar vía rápida y orden automática aunque la ampliación parezca leve', () => {
    expect(triage(base, true)).toMatchObject({ ruta: 'AMARILLA', estado: 'EN_REVISION' });
    expect(triage(base, false).ruta).toBe('VERDE');
  });
  it('debería conservar la prioridad roja si persisten señales de fraude', () => {
    expect(triage({ ...base, verdictFraude: 'SOSPECHA_RECAPTURA' }, true)).toMatchObject({
      ruta: 'ROJA',
      estado: 'EN_REVISION',
    });
  });
});
