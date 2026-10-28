import { describe, expect, it } from 'vitest';
import { puedeTransicionar } from './claim-state';
import { AppError } from '@/lib/errors';

/** Ejecuta la transición y captura el AppError lanzado. */
function capturarError(fn: () => void): AppError {
  try {
    fn();
  } catch (e) {
    return e as AppError;
  }
  throw new Error('Se esperaba que la transición lanzara un error');
}

describe('puedeTransicionar', () => {
  const perito = { rol: 'PERITO' as const, dictamenFinal: 'RECHAZADO' as const };
  const admin = { rol: 'ADMIN' as const };

  it('PENDIENTE → FAST_TRACK', () => {
    expect(() => puedeTransicionar('PENDIENTE', 'FAST_TRACK', admin)).not.toThrow();
  });

  it('PENDIENTE → EN_REVISION', () => {
    expect(() => puedeTransicionar('PENDIENTE', 'EN_REVISION', admin)).not.toThrow();
  });

  it('EN_REVISION → APROBADO', () => {
    expect(() => puedeTransicionar('EN_REVISION', 'APROBADO', perito)).not.toThrow();
  });

  it('EN_REVISION → RECHAZADO por PERITO con dictamen RECHAZADO', () => {
    expect(() => puedeTransicionar('EN_REVISION', 'RECHAZADO', perito)).not.toThrow();
  });

  it('EN_REVISION → EN_REVISION (ampliación)', () => {
    expect(() => puedeTransicionar('EN_REVISION', 'EN_REVISION', perito)).not.toThrow();
  });

  it('FAST_TRACK → FINALIZADO', () => {
    expect(() => puedeTransicionar('FAST_TRACK', 'FINALIZADO', admin)).not.toThrow();
  });

  it('APROBADO → FINALIZADO', () => {
    expect(() => puedeTransicionar('APROBADO', 'FINALIZADO', admin)).not.toThrow();
  });

  it('rechaza PENDIENTE → APROBADO (transición no válida)', () => {
    expect(capturarError(() => puedeTransicionar('PENDIENTE', 'APROBADO', perito)).code).toBe(
      'TRANSICION_INVALIDA',
    );
  });

  it('rechaza PENDIENTE → FINALIZADO (saltando pasos)', () => {
    expect(capturarError(() => puedeTransicionar('PENDIENTE', 'FINALIZADO', admin)).code).toBe(
      'TRANSICION_INVALIDA',
    );
  });

  it('rechaza FAST_TRACK → EN_REVISION (no retrocede)', () => {
    expect(capturarError(() => puedeTransicionar('FAST_TRACK', 'EN_REVISION', admin)).code).toBe(
      'TRANSICION_INVALIDA',
    );
  });

  it('rechaza RECHAZADO → cualquier cosa (estado terminal)', () => {
    expect(capturarError(() => puedeTransicionar('RECHAZADO', 'EN_REVISION', perito)).code).toBe(
      'TRANSICION_INVALIDA',
    );
  });

  it('rechaza FINALIZADO → cualquier cosa (estado terminal)', () => {
    expect(capturarError(() => puedeTransicionar('FINALIZADO', 'PENDIENTE', admin)).code).toBe(
      'TRANSICION_INVALIDA',
    );
  });

  it('rechaza el rechazo automático por el sistema (human-in-the-loop)', () => {
    const error = capturarError(() => puedeTransicionar('EN_REVISION', 'RECHAZADO', admin));
    expect(error.code).toBe('RECHAZO_AUTOMATICO_PROHIBIDO');
    expect(error.status).toBe(409);
  });

  it('rechaza el rechazo por ASEGURADO aunque sea manual', () => {
    expect(
      capturarError(() =>
        puedeTransicionar('EN_REVISION', 'RECHAZADO', {
          rol: 'ASEGURADO',
          dictamenFinal: 'RECHAZADO',
        }),
      ).code,
    ).toBe('RECHAZO_AUTOMATICO_PROHIBIDO');
  });

  it('rechaza el rechazo por PERITO sin dictamen RECHAZADO', () => {
    expect(
      capturarError(() =>
        puedeTransicionar('EN_REVISION', 'RECHAZADO', {
          rol: 'PERITO',
          dictamenFinal: 'APROBADO',
        }),
      ).code,
    ).toBe('RECHAZO_AUTOMATICO_PROHIBIDO');
  });

  it('rechaza el rechazo por PERITO sin dictamen', () => {
    expect(
      capturarError(() => puedeTransicionar('EN_REVISION', 'RECHAZADO', { rol: 'PERITO' })).code,
    ).toBe('RECHAZO_AUTOMATICO_PROHIBIDO');
  });

  it('rechaza el rechazo desde PENDIENTE (transición inexistente)', () => {
    expect(capturarError(() => puedeTransicionar('PENDIENTE', 'RECHAZADO', perito)).code).toBe(
      'TRANSICION_INVALIDA',
    );
  });

  it('una transición válida no lanza nada', () => {
    expect(() => puedeTransicionar('EN_REVISION', 'APROBADO', perito)).not.toThrow();
  });
});
