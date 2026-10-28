import { AppError } from '@/lib/errors';
import type { CambiosVehiculo, ClaimRepository } from '@/application/ports/claim-repository';
import type { Vehiculo } from '@/domain/entities';

/** Datos que el asegurado puede registrar de un vehículo. */
export type DatosVehiculo = {
  matricula: string;
  marca: string;
  modelo: string;
  numeroPoliza: string;
};

/**
 * Normaliza la matrícula: mayúsculas y sin espacios sobrantes.
 */
export function normalizarMatricula(matricula: string): string {
  return matricula.trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizar(datos: DatosVehiculo): DatosVehiculo {
  return {
    matricula: normalizarMatricula(datos.matricula),
    marca: datos.marca.trim().replace(/\s+/g, ' '),
    modelo: datos.modelo.trim().replace(/\s+/g, ' '),
    numeroPoliza: datos.numeroPoliza.trim().replace(/\s+/g, ' '),
  };
}

async function verificarDuplicados(
  repositorio: ClaimRepository,
  datos: DatosVehiculo,
  excluirId?: string,
): Promise<void> {
  const [porMatricula, porPoliza] = await Promise.all([
    repositorio.obtenerVehiculoPorMatricula(datos.matricula),
    repositorio.obtenerVehiculoPorNumeroPoliza(datos.numeroPoliza),
  ]);

  if (porMatricula && porMatricula.id !== excluirId) {
    throw new AppError('VEHICULO_DUPLICADO', 409, 'Ya existe un vehículo con esa matrícula', {
      campo: 'matricula',
    });
  }
  if (porPoliza && porPoliza.id !== excluirId) {
    throw new AppError(
      'VEHICULO_DUPLICADO',
      409,
      'Ya existe un vehículo con ese número de póliza',
      { campo: 'numero_poliza' },
    );
  }
}

/** Registra un vehículo nuevo del asegurado. */
export async function createVehicle(
  deps: { repositorio: ClaimRepository },
  input: { aseguradoId: string } & DatosVehiculo,
): Promise<Vehiculo> {
  const datos = normalizar(input);
  await verificarDuplicados(deps.repositorio, datos);

  return deps.repositorio.crearVehiculo({ aseguradoId: input.aseguradoId, ...datos });
}

/** Actualiza un vehículo. Solo su dueño puede editarlo. */
export async function updateVehicle(
  deps: { repositorio: ClaimRepository },
  input: { aseguradoId: string; vehiculoId: string } & Partial<DatosVehiculo>,
): Promise<Vehiculo> {
  const vehiculo = await deps.repositorio.obtenerVehiculoPorId(input.vehiculoId);
  if (!vehiculo) {
    throw new AppError('VEHICULO_NO_ENCONTRADO', 404, 'El vehículo no existe');
  }
  if (vehiculo.aseguradoId !== input.aseguradoId) {
    throw new AppError('VEHICULO_AJENO', 403, 'El vehículo no te pertenece');
  }

  const datos = normalizar({
    matricula: input.matricula ?? vehiculo.matricula,
    marca: input.marca ?? vehiculo.marca,
    modelo: input.modelo ?? vehiculo.modelo,
    numeroPoliza: input.numeroPoliza ?? vehiculo.numeroPoliza,
  });

  await verificarDuplicados(deps.repositorio, datos, vehiculo.id);

  return deps.repositorio.actualizarVehiculo(vehiculo.id, datos as CambiosVehiculo);
}

/**
 * Elimina un vehículo sin siniestros asociados.
 * Con siniestros devuelve 409 VEHICULO_CON_SINIESTROS.
 */
export async function deleteVehicle(
  deps: { repositorio: ClaimRepository },
  input: { aseguradoId: string; vehiculoId: string },
): Promise<void> {
  const vehiculo = await deps.repositorio.obtenerVehiculoPorId(input.vehiculoId);
  if (!vehiculo) {
    throw new AppError('VEHICULO_NO_ENCONTRADO', 404, 'El vehículo no existe');
  }
  if (vehiculo.aseguradoId !== input.aseguradoId) {
    throw new AppError('VEHICULO_AJENO', 403, 'El vehículo no te pertenece');
  }

  const siniestros = await deps.repositorio.contarSiniestrosPorVehiculo(vehiculo.id);
  if (siniestros > 0) {
    throw new AppError(
      'VEHICULO_CON_SINIESTROS',
      409,
      'No se puede eliminar un vehículo con siniestros reportados',
    );
  }

  await deps.repositorio.eliminarVehiculo(vehiculo.id);
}