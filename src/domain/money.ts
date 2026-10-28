/**
 * Helper de dinero: USD con redondeo a 2 decimales.
 * Función pura del dominio (sin dependencias externas).
 */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}
