import { describe, expect, it, beforeEach } from 'vitest';
import {
  createVehicle,
  deleteVehicle,
  normalizarMatricula,
  updateVehicle,
} from './manage-vehicle';
import { InMemoryClaimRepository } from '@/infrastructure/repositories/in-memory-claim-repository';
import { AppError } from '@/lib/errors';

const ASEGURADO = '00000000-0000-0000-0000-000000000001';
const OTRO = '00000000-0000-0000-0000-000000000002';

const DATOS = {
  matricula: 'pba 1234',
  marca: 'Toyota',
  modelo: 'Corolla',
  numeroPoliza: 'pol-001',
};

let repo: InMemoryClaimRepository;

beforeEach(() => {
  repo = new InMemoryClaimRepository();
});

describe('normalizarMatricula', () => {
  it('pasa a mayúsculas y quita espacios sobrantes', () => {
    expect(normalizarMatricula('  pba   1234 ')).toBe('PBA 1234');
  });
});

describe('createVehicle', () => {
  it('crea el vehículo del asegurado con la matrícula normalizada', async () => {
    const vehiculo = await createVehicle({ repositorio: repo }, { aseguradoId: ASEGURADO, ...DATOS });

    expect(vehiculo.matricula).toBe('PBA 1234');
    expect(vehiculo.aseguradoId).toBe(ASEGURADO);
    await expect(repo.listarVehiculosPorAsegurado(ASEGURADO)).resolves.toHaveLength(1);
  });

  it('rechaza matrícula duplicada con VEHICULO_DUPLICADO y el campo', async () => {
    await createVehicle({ repositorio: repo }, { aseguradoId: ASEGURADO, ...DATOS });

    const error = await createVehicle({ repositorio: repo }, {
      aseguradoId: ASEGURADO,
      ...DATOS,
      numeroPoliza: 'pol-002',
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('VEHICULO_DUPLICADO');
    expect((error as AppError).status).toBe(409);
    expect((error as AppError).details).toEqual({ campo: 'matricula' });
  });

  it('rechaza número de póliza duplicado indicando el campo', async () => {
    await createVehicle({ repositorio: repo }, { aseguradoId: ASEGURADO, ...DATOS });

    const error = await createVehicle({ repositorio: repo }, {
      aseguradoId: ASEGURADO,
      matricula: 'pba-9999',
      marca: 'Kia',
      modelo: 'Rio',
      numeroPoliza: 'pol-001',
    }).catch((e: unknown) => e);

    expect((error as AppError).code).toBe('VEHICULO_DUPLICADO');
    expect((error as AppError).details).toEqual({ campo: 'numero_poliza' });
  });
});

describe('updateVehicle', () => {
  it('actualiza los datos del vehículo', async () => {
    const vehiculo = await createVehicle({ repositorio: repo }, { aseguradoId: ASEGURADO, ...DATOS });

    const actualizado = await updateVehicle({ repositorio: repo }, {
      aseguradoId: ASEGURADO,
      vehiculoId: vehiculo.id,
      modelo: 'Corolla XLE',
    });

    expect(actualizado.modelo).toBe('Corolla XLE');
    expect(actualizado.matricula).toBe('PBA 1234');
  });

  it('permite guardar los mismos datos sin falsos duplicados', async () => {
    const vehiculo = await createVehicle({ repositorio: repo }, { aseguradoId: ASEGURADO, ...DATOS });

    await expect(
      updateVehicle({ repositorio: repo }, {
        aseguradoId: ASEGURADO,
        vehiculoId: vehiculo.id,
        ...DATOS,
      }),
    ).resolves.toMatchObject({ id: vehiculo.id });
  });

  it('rechaza editar un vehículo ajeno', async () => {
    const vehiculo = await createVehicle({ repositorio: repo }, { aseguradoId: ASEGURADO, ...DATOS });

    const error = await updateVehicle({ repositorio: repo }, {
      aseguradoId: OTRO,
      vehiculoId: vehiculo.id,
      modelo: 'otro',
    }).catch((e: unknown) => e);

    expect((error as AppError).code).toBe('VEHICULO_AJENO');
    expect((error as AppError).status).toBe(403);
  });

  it('devuelve 404 si el vehículo no existe', async () => {
    const error = await updateVehicle({ repositorio: repo }, {
      aseguradoId: ASEGURADO,
      vehiculoId: 'no-existe',
      modelo: 'x',
    }).catch((e: unknown) => e);

    expect((error as AppError).code).toBe('VEHICULO_NO_ENCONTRADO');
  });
});

describe('deleteVehicle', () => {
  it('elimina un vehículo sin siniestros', async () => {
    const vehiculo = await createVehicle({ repositorio: repo }, { aseguradoId: ASEGURADO, ...DATOS });

    await deleteVehicle({ repositorio: repo }, {
      aseguradoId: ASEGURADO,
      vehiculoId: vehiculo.id,
    });

    await expect(repo.obtenerVehiculoPorId(vehiculo.id)).resolves.toBeNull();
  });

  it('rechaza eliminar un vehículo con siniestros', async () => {
    const vehiculo = await createVehicle({ repositorio: repo }, { aseguradoId: ASEGURADO, ...DATOS });
    await repo.crearSiniestro({
      aseguradoId: ASEGURADO,
      vehiculoId: vehiculo.id,
      descripcion: null,
      latitud: 0,
      longitud: 0,
      fechaIncidente: new Date().toISOString(),
      fechaRegistro: new Date().toISOString(),
    });

    const error = await deleteVehicle({ repositorio: repo }, {
      aseguradoId: ASEGURADO,
      vehiculoId: vehiculo.id,
    }).catch((e: unknown) => e);

    expect((error as AppError).code).toBe('VEHICULO_CON_SINIESTROS');
    expect((error as AppError).status).toBe(409);
    await expect(repo.obtenerVehiculoPorId(vehiculo.id)).resolves.not.toBeNull();
  });

  it('rechaza eliminar un vehículo ajeno', async () => {
    const vehiculo = await createVehicle({ repositorio: repo }, { aseguradoId: ASEGURADO, ...DATOS });

    const error = await deleteVehicle({ repositorio: repo }, {
      aseguradoId: OTRO,
      vehiculoId: vehiculo.id,
    }).catch((e: unknown) => e);

    expect((error as AppError).code).toBe('VEHICULO_AJENO');
  });
});