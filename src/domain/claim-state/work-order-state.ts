import { AppError } from '@/lib/errors';
import type { EstadoOrden } from '@/domain/types';

const TRANSICIONES: Record<EstadoOrden, readonly EstadoOrden[]> = {
  EMITIDA: ['RECIBIDO'],
  RECIBIDO: ['EN_REPARACION'],
  EN_REPARACION: ['COMPLETADO'],
  COMPLETADO: [],
};

/**
 * Máquina de estados pura de la orden de trabajo:
 * EMITIDA → RECIBIDO → EN_REPARACION → COMPLETADO.
 * Solo un paso adelante, nunca atrás. Lanza AppError(409).
 */
export function puedeTransicionarOrden(estadoActual: EstadoOrden, destino: EstadoOrden): void {
  const permitidos = TRANSICIONES[estadoActual];
  if (!permitidos.includes(destino)) {
    throw new AppError(
      'TRANSICION_INVALIDA',
      409,
      `No se puede pasar de ${estadoActual} a ${destino}`,
    );
  }
}
