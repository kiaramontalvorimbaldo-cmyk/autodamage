import { describe, expect, it } from 'vitest';
import { issueWorkOrder } from './issue-work-order';
import { InMemoryClaimRepository } from '@/infrastructure/repositories/in-memory-claim-repository';
import { InMemoryWorkOrderRepository } from '@/infrastructure/repositories/in-memory-work-order-repository';
import { InMemoryAuditRepository } from '@/infrastructure/repositories/in-memory-audit-repository';
import { InMemoryBaremoRepository } from '@/infrastructure/repositories/in-memory-baremo-repository';

async function sembrar(opts: { conOrdenPrevia?: boolean } = {}) {
  const repositorio = new InMemoryClaimRepository();
  const ordenes = new InMemoryWorkOrderRepository();
  const auditoria = new InMemoryAuditRepository();
  const baremo = new InMemoryBaremoRepository();

  const vehiculo = await repositorio.crearVehiculo({
    aseguradoId: 'aseg-1',
    matricula: 'ABC-123',
    marca: 'Toyota',
    modelo: 'Yaris',
    numeroPoliza: 'POL-1',
  });
  const siniestro = await repositorio.crearSiniestro({
    aseguradoId: 'aseg-1',
    vehiculoId: vehiculo.id,
    descripcion: null,
    latitud: 0,
    longitud: 0,
    fechaIncidente: '2026-10-01T00:00:00Z',
    fechaRegistro: '2026-10-01T00:00:00Z',
  });
  await repositorio.actualizarSiniestro(siniestro.id, { estado: 'FAST_TRACK', ruta: 'VERDE' });
  await repositorio.crearInspeccion({
    siniestroId: siniestro.id,
    tipoInspeccion: 'DIGITAL_IA',
    verdictFraude: 'SIN_RIESGO',
    indicadoresFraude: [],
    nivelSeveridad: 'LEVE',
    costoTotalEstimado: 150,
    confianzaGlobal: 0.9,
    modeloIa: 'm',
    versionPrompt: 'v1',
    respuestaIa: null,
  });

  ordenes.agregarTaller({
    id: 'taller-a',
    usuarioId: 'user-taller-a',
    nombre: 'Taller A',
    direccion: null,
    telefono: null,
    activo: true,
  });
  ordenes.agregarTaller({
    id: 'taller-b',
    usuarioId: 'user-taller-b',
    nombre: 'Taller B',
    direccion: null,
    telefono: null,
    activo: true,
  });

  if (opts.conOrdenPrevia) {
    await ordenes.crearOrden({
      siniestroId: siniestro.id,
      tallerId: 'taller-a',
      montoAutorizado: 150,
    });
  }

  return { repositorio, ordenes, auditoria, baremo, siniestro };
}

describe('issueWorkOrder', () => {
  it('crea orden con monto igual al costo estimado y audita', async () => {
    const deps = await sembrar();
    const orden = await issueWorkOrder(deps, deps.siniestro.id);
    expect(orden).not.toBeNull();
    expect(orden!.montoAutorizado).toBe(150);
    expect(orden!.estado).toBe('EMITIDA');
    const registros = deps.auditoria.todos();
    expect(registros.some((r) => r.accion === 'ORDEN_EMITIDA')).toBe(true);
  });

  it('es idempotente: doble ejecución no duplica la orden', async () => {
    const deps = await sembrar();
    const primera = await issueWorkOrder(deps, deps.siniestro.id);
    const segunda = await issueWorkOrder(deps, deps.siniestro.id);
    expect(segunda?.id).toBe(primera?.id);
    const todas = await deps.ordenes.listarTodasLasOrdenes();
    expect(todas).toHaveLength(1);
  });

  it('devuelve la existente si ya hay orden', async () => {
    const deps = await sembrar({ conOrdenPrevia: true });
    const orden = await issueWorkOrder(deps, deps.siniestro.id);
    expect(orden?.tallerId).toBe('taller-a');
  });

  it('sin talleres activos: siniestro a EN_REVISION y auditoría', async () => {
    const deps = await sembrar();
    await deps.ordenes.listarTalleres();
    for (const t of await deps.ordenes.listarTalleres()) {
      t.activo = false;
    }
    const orden = await issueWorkOrder(deps, deps.siniestro.id);
    expect(orden).toBeNull();
    const siniestro = await deps.repositorio.obtenerSiniestroPorId(deps.siniestro.id);
    expect(siniestro?.estado).toBe('EN_REVISION');
    expect(deps.auditoria.todos().some((r) => r.accion === 'SIN_TALLERES_DISPONIBLES')).toBe(true);
  });
});
