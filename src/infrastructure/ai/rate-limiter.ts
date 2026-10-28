import type { RateLimiter } from '@/application/ports/rate-limiter';

/**
 * Limitador de tasa por minuto (token bucket en memoria).
 * Tope interno de análisis por minuto por instancia (AI_MAX_RPM).
 */
export class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private ultimaRecarga: number;

  constructor(
    private readonly capacidad: number,
    private readonly recargaPorMinuto: number,
  ) {
    this.tokens = capacidad;
    this.ultimaRecarga = Date.now();
  }

  /** Intenta consumir un token. Devuelve false si el límite se excedió. */
  intentar(): boolean {
    const ahora = Date.now();
    const minutosTranscurridos = (ahora - this.ultimaRecarga) / 60_000;
    this.tokens = Math.min(
      this.capacidad,
      this.tokens + minutosTranscurridos * this.recargaPorMinuto,
    );
    this.ultimaRecarga = ahora;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Tokens disponibles (para pruebas). */
  disponibles(): number {
    return this.tokens;
  }
}
