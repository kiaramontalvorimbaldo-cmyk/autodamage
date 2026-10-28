import { describe, expect, it } from 'vitest';
import { roundMoney } from './money';

describe('roundMoney', () => {
  it('redondea a dos decimales', () => {
    expect(roundMoney(1.234)).toBe(1.23);
    expect(roundMoney(1.236)).toBe(1.24);
  });

  it('devuelve enteros sin decimales', () => {
    expect(roundMoney(150)).toBe(150);
    expect(roundMoney(0)).toBe(0);
  });

  it('estabiliza errores de punto flotante', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('redondea números negativos', () => {
    expect(roundMoney(-3.14159)).toBe(-3.14);
  });

  it('redondea 49.999 a 50', () => {
    expect(roundMoney(49.999)).toBe(50);
  });
});
