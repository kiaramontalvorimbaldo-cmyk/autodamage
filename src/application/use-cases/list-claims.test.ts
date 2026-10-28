import { describe, it, expect } from 'vitest';
import { listClaims } from './list-claims';
import { InMemoryClaimRepository } from '@/infrastructure/repositories/in-memory-claim-repository';
import type { Rol } from '@/domain/types';

const ASEGURADO = '00000000-0000-0000-0000-000000000001';
const OTRO = '00000000-0000-0000-0000-000000000002';

async function sembrar() {
  const repositorio = new InMemoryClaimRepository();
  repositorio.ahora = new Date('2026-10-05T10:00:00Z');
  const vehiculo = await repositorio.crearVehiculo({
    aseguradoId: ASEGURADO,
    matricula: 'ABC-123',
    marca: 'Toyota',
    modelo: 'Yaris',
    numeroPoliza: 'POL-1',
  });
  const base = {
    vehiculoId: vehiculo.id,
    descripcion: 'Choque leve',
    latitud: 19.4326,
    longitud: -99.1332,
    fechaIncidente: '2026-10-04T08:00:00Z',
  };
  const s1 = await repositorio.crearSiniestro({
    ...base,
    aseguradoId: ASEGURADO,
    fechaRegistro: '2026-10-05T09:00:00Z',
  });
  await repositorio.actualizarSiniestro(s1.id, {
    estado: 'EN_REVISION',
    ruta: 'AMARILLA',
  });
  const s2 = await repositorio.crearSiniestro({
    ...base,
    aseguradoId: ASEGURADO,
    fechaRegistro: '2026-10-05T09:30:00Z',
  });
  await repositorio.actualizarSiniestro(s2.id, {
    estado: 'FAST_TRACK',
    ruta: 'VERDE',
  });
  // Siniestro de otro asegurado.
  const vehiculoAjeno = await repositorio.crearVehiculo({
    aseguradoId: OTRO,
    matricula: 'XYZ-999',
    marca: 'Nissan',
    modelo: 'Versa',
    numeroPoliza: 'POL-2',
  });
  const s3 = await repositorio.crearSiniestro({
    ...base,
    aseguradoId: OTRO,
    vehiculoId: vehiculoAjeno.id,
    fechaRegistro: '2026-10-05T09:45:00Z',
  });
  await repositorio.actualizarSiniestro(s3.id, {
    estado: 'EN_REVISION',
    ruta: 'ROJA',
  });
  return { repositorio, s1, s2, s3 };
}

describe('listClaims', () => {
  it('debería paginar seguimiento como un grupo y mantener el aislamiento del asegurado', async () => {
    const { repositorio, s2 } = await sembrar();
    const seguimiento = await listClaims({ repositorio }, ASEGURADO, 'PERITO', {
      bandeja: 'seguimiento',
      pageSize: 1,
    });
    expect(seguimiento.total).toBe(1);
    expect(seguimiento.items[0].id).toBe(s2.id);
    const ajeno = await listClaims({ repositorio }, OTRO, 'ASEGURADO', { bandeja: 'seguimiento' });
    expect(ajeno.items).toHaveLength(0);
  });
  it('debería mostrar al asegurado solo sus siniestros', async () => {
    const { repositorio, s1, s2 } = await sembrar();
    const resultado = await listClaims({ repositorio }, ASEGURADO, 'ASEGURADO' as Rol, {});
    expect(resultado.total).toBe(2);
    const ids = resultado.items.map((s) => s.id);
    expect(ids).toContain(s1.id);
    expect(ids).toContain(s2.id);
  });

  it('debería mostrar todos los siniestros a un PERITO', async () => {
    const { repositorio, s1, s3 } = await sembrar();
    const resultado = await listClaims({ repositorio }, 'perito-1', 'PERITO' as Rol, {});
    expect(resultado.total).toBe(3);
    const ids = resultado.items.map((s) => s.id);
    expect(ids).toContain(s1.id);
    expect(ids).toContain(s3.id);
  });

  it('debería filtrar por ruta', async () => {
    const { repositorio, s2 } = await sembrar();
    const resultado = await listClaims({ repositorio }, 'perito-1', 'PERITO' as Rol, {
      ruta: 'VERDE',
    });
    expect(resultado.total).toBe(1);
    expect(resultado.items[0].id).toBe(s2.id);
  });

  it('debería filtrar por estado', async () => {
    const { repositorio, s1 } = await sembrar();
    const resultado = await listClaims({ repositorio }, 'perito-1', 'PERITO' as Rol, {
      estado: 'FAST_TRACK',
    });
    expect(resultado.total).toBe(1);
    expect(resultado.items[0].estado).toBe('FAST_TRACK');
    expect(resultado.items[0].id).not.toBe(s1.id);
  });

  it('debería ordenar por fecha_registro descendente', async () => {
    const { repositorio, s1, s2 } = await sembrar();
    const resultado = await listClaims({ repositorio }, ASEGURADO, 'ASEGURADO' as Rol, {});
    expect(resultado.items[0].id).toBe(s2.id); // 09:30 > 09:00
    expect(resultado.items[1].id).toBe(s1.id);
  });

  it('debería paginar correctamente', async () => {
    const { repositorio, s2 } = await sembrar();
    const primera = await listClaims({ repositorio }, 'perito-1', 'PERITO' as Rol, {
      page: 1,
      pageSize: 2,
    });
    expect(primera.items).toHaveLength(2);
    expect(primera.total).toBe(3);
    const segunda = await listClaims({ repositorio }, 'perito-1', 'PERITO' as Rol, {
      page: 2,
      pageSize: 2,
    });
    expect(segunda.items).toHaveLength(1);
    expect(segunda.page).toBe(2);
    // El VERDE está en la primera página (el más reciente del asegurado).
    expect(primera.items.map((s) => s.id)).toContain(s2.id);
  });

  it('debería devolver página vacía más allá del total', async () => {
    const { repositorio } = await sembrar();
    const resultado = await listClaims({ repositorio }, ASEGURADO, 'ASEGURADO' as Rol, {
      page: 5,
      pageSize: 2,
    });
    expect(resultado.items).toHaveLength(0);
    expect(resultado.total).toBe(2);
  });
});
