import type { Siniestro } from '../entities';
import type { EstadoSiniestro } from '../types';

export type BandejaPerito = 'pendientes' | 'seguimiento' | 'resueltos';
export const ESTADOS_BANDEJA: Record<BandejaPerito, EstadoSiniestro[]> = {
  pendientes: ['EN_REVISION'],
  seguimiento: ['PENDIENTE', 'FAST_TRACK', 'APROBADO'],
  resueltos: ['RECHAZADO', 'FINALIZADO'],
};
export function admiteDictamen(s: Pick<Siniestro, 'estado' | 'analisisEstado'>): boolean {
  return s.estado === 'EN_REVISION' && s.analisisEstado !== 'EN_PROCESO';
}
