/**
 * Puerto del limitador de tasa (patrón token bucket).
 * Implementación en infraestructura; el caso de uso
 * solo depende de esta interfaz.
 */
export interface RateLimiter {
  /** Intenta consumir una unidad. Devuelve false si se excedió el límite. */
  intentar(): boolean;
}
