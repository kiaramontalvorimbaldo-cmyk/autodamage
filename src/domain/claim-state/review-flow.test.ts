import { describe, expect, it } from 'vitest';
import { admiteDictamen, ESTADOS_BANDEJA } from './review-flow';
describe('flujo del perito', () => {
  it('debería mantener vía rápida y aprobados en seguimiento, sin llamarlos resueltos', () => {
    expect(ESTADOS_BANDEJA.seguimiento).toContain('FAST_TRACK');
    expect(ESTADOS_BANDEJA.seguimiento).toContain('APROBADO');
    expect(ESTADOS_BANDEJA.resueltos).toEqual(['RECHAZADO', 'FINALIZADO']);
  });
  it.each(['FAST_TRACK', 'APROBADO', 'RECHAZADO', 'FINALIZADO', 'PENDIENTE'] as const)(
    'debería impedir el dictamen en %s',
    (estado) => {
      expect(admiteDictamen({ estado, analisisEstado: 'COMPLETADO' })).toBe(false);
    },
  );
  it('debería permitir un dictamen en revisión, excepto mientras se reanaliza', () => {
    expect(admiteDictamen({ estado: 'EN_REVISION', analisisEstado: 'COMPLETADO' })).toBe(true);
    expect(admiteDictamen({ estado: 'EN_REVISION', analisisEstado: 'EN_PROCESO' })).toBe(false);
  });
});
