import { AppError } from '@/lib/errors';

export type TallerCandidato = {
  id: string;
  activo: boolean;
  ordenesAbiertas: number;
  ordenAbiertaMasAntigua: Date | null;
};

/**
 * Asignación determinista de taller:
 * menor número de órdenes abiertas; empate → orden abierta más antigua;
 * sin órdenes → menor id. Ignora talleres inactivos.
 * Sin talleres activos → AppError('SIN_TALLERES_DISPONIBLES', 409).
 */
export function assignWorkshop(talleres: readonly TallerCandidato[]): string {
  const activos = talleres.filter((t) => t.activo);
  if (activos.length === 0) {
    throw new AppError('SIN_TALLERES_DISPONIBLES', 409, 'No hay talleres activos disponibles');
  }

  const ordenados = [...activos].sort((a, b) => {
    if (a.ordenesAbiertas !== b.ordenesAbiertas) {
      return a.ordenesAbiertas - b.ordenesAbiertas;
    }
    const fechaA = a.ordenAbiertaMasAntigua?.getTime() ?? Number.POSITIVE_INFINITY;
    const fechaB = b.ordenAbiertaMasAntigua?.getTime() ?? Number.POSITIVE_INFINITY;
    if (fechaA !== fechaB) return fechaA - fechaB;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return ordenados[0].id;
}
