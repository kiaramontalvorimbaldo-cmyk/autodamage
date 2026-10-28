import { AppError } from '@/lib/errors';
import type { ClaimRepository } from '@/application/ports/claim-repository';
import type { Clock } from '@/application/ports/clock';
import type { Siniestro } from '@/domain/entities';

export type CrearSiniestroInput = {
  id?: string;
  aseguradoId: string;
  vehiculoId: string;
  descripcion: string | null;
  latitud: number;
  longitud: number;
  fechaIncidente: string;
};

/**
 * Crea un siniestro en estado PENDIENTE.
 * El vehículo debe existir y pertenecer al asegurado.
 */
export async function createClaim(
  deps: { repositorio: ClaimRepository; reloj: Clock },
  input: CrearSiniestroInput,
): Promise<Siniestro> {
  if (input.id) {
    const existente = await deps.repositorio.obtenerSiniestroPorId(input.id);
    if (existente) {
      if (
        existente.aseguradoId !== input.aseguradoId ||
        existente.vehiculoId !== input.vehiculoId ||
        new Date(existente.fechaIncidente).getTime() !== new Date(input.fechaIncidente).getTime() ||
        existente.descripcion !== input.descripcion ||
        existente.latitud !== input.latitud ||
        existente.longitud !== input.longitud
      )
        throw new AppError(
          'SOLICITUD_CONFLICTIVA',
          409,
          'Esta solicitud ya corresponde a otro reporte',
        );
      return existente;
    }
  }
  const vehiculo = await deps.repositorio.obtenerVehiculoPorId(input.vehiculoId);
  if (!vehiculo) {
    throw new AppError('VEHICULO_NO_ENCONTRADO', 404, 'El vehículo no existe');
  }
  if (vehiculo.aseguradoId !== input.aseguradoId) {
    throw new AppError('VEHICULO_AJENO', 403, 'El vehículo no te pertenece');
  }

  return deps.repositorio.crearSiniestro({
    ...input,
    fechaRegistro: deps.reloj.ahora().toISOString(),
  });
}
