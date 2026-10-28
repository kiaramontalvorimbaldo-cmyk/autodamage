import { describe, expect, it } from 'vitest';
import { puedeTransicionarOrden } from './work-order-state';

describe('work-order-state', () => {
  it.each([
    ['EMITIDA', 'RECIBIDO'],
    ['RECIBIDO', 'EN_REPARACION'],
    ['EN_REPARACION', 'COMPLETADO'],
  ] as const)('debería permitir %s → %s', (actual, destino) => {
    expect(() => puedeTransicionarOrden(actual, destino)).not.toThrow();
  });

  it.each([
    ['EMITIDA', 'EN_REPARACION'],
    ['EMITIDA', 'COMPLETADO'],
    ['RECIBIDO', 'COMPLETADO'],
    ['RECIBIDO', 'EMITIDA'],
    ['EN_REPARACION', 'RECIBIDO'],
    ['COMPLETADO', 'EMITIDA'],
    ['EMITIDA', 'EMITIDA'],
  ] as const)('debería rechazar %s → %s', (actual, destino) => {
    expect(() => puedeTransicionarOrden(actual, destino)).toThrowError(
      /TRANSICION_INVALIDA|No se puede/,
    );
  });
});
