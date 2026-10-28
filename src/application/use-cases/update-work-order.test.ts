import { describe, expect, it } from 'vitest';
import { updateWorkOrder } from './update-work-order';
import { InMemoryClaimRepository } from '@/infrastructure/repositories/in-memory-claim-repository';
import { InMemoryWorkOrderRepository } from '@/infrastructure/repositories/in-memory-work-order-repository';
import { InMemoryAuditRepository } from '@/infrastructure/repositories/in-memory-audit-repository';

async function sembrar() {
  const repositorio = new InMemoryClaimRepository();
  const ordenes = new InMemoryWorkOrderRepository();
  const auditoria = new InMemoryAuditRepository();

  const vehiculo = await repositorio.crearVehiculo({
    aseguradoId: 'a1',
    matricula: 'ABC',
    marca: 'Toyota',
    modelo: 'Yaris',
    numeroPoliza: 'P1',
  });
  const siniestro = await repositorio.crearSiniestro({
    aseguradoId: 'a1',
    vehiculoId: vehiculo.id,
    descripcion: null,
    latitud: 0,
    longitud: 0,
    fechaIncidente: '2026-10-01T00:00:00Z',
    fechaRegistro: '2026-10-01T00:00:00Z',
  });
  await repositorio.actualizarSiniestro(siniestro.id, {
    estado: 'APROBADO',
    ruta: 'AMARILLA',
  });
  ordenes.agregarTaller({
    id: 'taller-1',
    usuarioId: 'user-taller',
    nombre: 'T1',
    direccion: null,
    telefono: null,
    activo: true,
  });
  const orden = await ordenes.crearOrden({
    siniestroId: siniestro.id,
    tallerId: 'taller-1',
    montoAutorizado: 100,
  });
  return { repositorio, ordenes, auditoria, siniestro, orden };
}

describe('updateWorkOrder', () => {
  it('debería conservar la orden en reparación si el siniestro no puede finalizar', async () => {
    const deps = await sembrar();
    await deps.ordenes.actualizarEstadoOrden(deps.orden.id, 'EN_REPARACION');
    await deps.repositorio.actualizarSiniestro(deps.siniestro.id, { estado: 'RECHAZADO' });
    await expect(
      updateWorkOrder(deps, {
        ordenId: deps.orden.id,
        usuarioTaller: 'user-taller',
        nuevoEstado: 'COMPLETADO',
      }),
    ).rejects.toThrow();
    expect((await deps.ordenes.obtenerOrdenPorId(deps.orden.id))?.estado).toBe('EN_REPARACION');
    expect(deps.auditoria.todos()).toHaveLength(0);
  });
  it('avanza RECIBIDO → EN_REPARACION → COMPLETADO y finaliza el siniestro', async () => {
    const deps = await sembrar();
    await updateWorkOrder(deps, {
      ordenId: deps.orden.id,
      usuarioTaller: 'user-taller',
      nuevoEstado: 'RECIBIDO',
    });
    await updateWorkOrder(deps, {
      ordenId: deps.orden.id,
      usuarioTaller: 'user-taller',
      nuevoEstado: 'EN_REPARACION',
    });
    await updateWorkOrder(deps, {
      ordenId: deps.orden.id,
      usuarioTaller: 'user-taller',
      nuevoEstado: 'COMPLETADO',
    });
    const orden = await deps.ordenes.obtenerOrdenPorId(deps.orden.id);
    expect(orden?.estado).toBe('COMPLETADO');
    const siniestro = await deps.repositorio.obtenerSiniestroPorId(deps.siniestro.id);
    expect(siniestro?.estado).toBe('FINALIZADO');
  });

  it('rechaza saltar un paso', async () => {
    const deps = await sembrar();
    await expect(
      updateWorkOrder(deps, {
        ordenId: deps.orden.id,
        usuarioTaller: 'user-taller',
        nuevoEstado: 'COMPLETADO',
      }),
    ).rejects.toThrow(/TRANSICION_INVALIDA|No se puede/);
  });

  it('solo el taller dueño puede avanzar', async () => {
    const deps = await sembrar();
    deps.ordenes.agregarTaller({
      id: 'taller-2',
      usuarioId: 'user-otro',
      nombre: 'T2',
      direccion: null,
      telefono: null,
      activo: true,
    });
    await expect(
      updateWorkOrder(deps, {
        ordenId: deps.orden.id,
        usuarioTaller: 'user-otro',
        nuevoEstado: 'RECIBIDO',
      }),
    ).rejects.toThrow(/No eres el taller/);
  });
});
