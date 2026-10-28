import { AppError } from '@/lib/errors';
import type { DictamenFinal, EstadoSiniestro, Rol } from '@/domain/types';

/**
 * Transiciones permitidas de la máquina de estados del siniestro.
 */
const TRANSICIONES_VALIDAS: Record<EstadoSiniestro, readonly EstadoSiniestro[]> = {
  PENDIENTE: ['FAST_TRACK', 'EN_REVISION'],
  FAST_TRACK: ['FINALIZADO'],
  EN_REVISION: ['APROBADO', 'RECHAZADO', 'EN_REVISION'],
  APROBADO: ['FINALIZADO'],
  RECHAZADO: [],
  FINALIZADO: [],
};

export type ActorTransicion = {
  rol: Rol;
  dictamenFinal?: DictamenFinal | null;
};

/**
 * Valida una transición de estado del siniestro.
 *
 * - RECHAZADO solo es posible si el actor es PERITO y el dictamen es RECHAZADO.
 *   Cualquier intento automático lanza RECHAZO_AUTOMATICO_PROHIBIDO (409).
 * - El resto de transiciones deben estar en la tabla de transiciones válidas.
 *
 * No modifica nada: es una función pura que valida (lanza o devuelve void).
 */
export function puedeTransicionar(
  estadoActual: EstadoSiniestro,
  destino: EstadoSiniestro,
  actor: ActorTransicion,
): void {
  if (destino === 'RECHAZADO') {
    if (actor.rol !== 'PERITO' || actor.dictamenFinal !== 'RECHAZADO') {
      throw new AppError(
        'RECHAZO_AUTOMATICO_PROHIBIDO',
        409,
        'Solo un perito puede rechazar un siniestro, mediante un dictamen RECHAZADO',
      );
    }
  }

  const permitidos = TRANSICIONES_VALIDAS[estadoActual];
  if (!permitidos.includes(destino)) {
    throw new AppError(
      'TRANSICION_INVALIDA',
      409,
      `No se puede pasar de ${estadoActual} a ${destino}`,
    );
  }
}
