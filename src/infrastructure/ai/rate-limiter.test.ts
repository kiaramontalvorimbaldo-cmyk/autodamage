import { describe, expect, it, vi } from 'vitest';
import { TokenBucketRateLimiter } from './rate-limiter';

describe('TokenBucketRateLimiter', () => {
  it('consume tokens hasta agotar la capacidad', () => {
    const limitador = new TokenBucketRateLimiter(3, 3);
    expect(limitador.intentar()).toBe(true);
    expect(limitador.intentar()).toBe(true);
    expect(limitador.intentar()).toBe(true);
    expect(limitador.intentar()).toBe(false);
  });

  it('se recarga con el tiempo', () => {
    vi.useFakeTimers();
    const limitador = new TokenBucketRateLimiter(1, 60);
    expect(limitador.intentar()).toBe(true);
    expect(limitador.intentar()).toBe(false);

    // Avanzar 1 segundo: con recarga de 60/min → 1 token/seg
    vi.advanceTimersByTime(1_000);
    expect(limitador.intentar()).toBe(true);
    vi.useRealTimers();
  });

  it('la recarga nunca excede la capacidad', () => {
    vi.useFakeTimers();
    const limitador = new TokenBucketRateLimiter(2, 60);
    limitador.intentar();
    limitador.intentar();

    // Avanzar 10 minutos: la recarga se acumula pero no pasa de 2
    vi.advanceTimersByTime(10 * 60_000);
    expect(limitador.disponibles()).toBeLessThanOrEqual(2);
    expect(limitador.intentar()).toBe(true);
    expect(limitador.intentar()).toBe(true);
    expect(limitador.intentar()).toBe(false);
    vi.useRealTimers();
  });
});
