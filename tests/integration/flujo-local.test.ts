import { describe, expect, it } from 'vitest';
import { createClaim } from '@/application/use-cases/create-claim';
import { uploadImage } from '@/application/use-cases/upload-image';
import { analyzeClaim } from '@/application/use-cases/analyze-claim';
import { getClaim } from '@/application/use-cases/get-claim';
import { issueVerdict } from '@/application/use-cases/issue-verdict';
import { updateWorkOrder } from '@/application/use-cases/update-work-order';
import { reanalyzeClaim } from '@/application/use-cases/reanalyze-claim';
import { clockFijo } from '@/application/ports/clock';
import { InMemoryClaimRepository } from '@/infrastructure/repositories/in-memory-claim-repository';
import { InMemoryBaremoRepository } from '@/infrastructure/repositories/in-memory-baremo-repository';
import { InMemoryAuditRepository } from '@/infrastructure/repositories/in-memory-audit-repository';
import { InMemoryWorkOrderRepository } from '@/infrastructure/repositories/in-memory-work-order-repository';
import { InMemoryStorageService } from '@/infrastructure/storage/in-memory-storage';
import { MockProvider } from '@/infrastructure/ai/mock-provider';
import { TokenBucketRateLimiter } from '@/infrastructure/ai/rate-limiter';

// Integración de casos de uso: no prueba HTTP, Supabase, cámara ni Gemini real.
async function preparar() {
  const repositorio = new InMemoryClaimRepository();
  repositorio.ahora = new Date('2026-10-21T12:00:00Z');
  const baremo = new InMemoryBaremoRepository();
  baremo.definir('FARO_DEL_IZQ', {
    costo_repuesto_base: 120,
    horas_mano_obra: 1,
    costo_hora_mo: 30,
  });
  const ordenes = new InMemoryWorkOrderRepository();
  ordenes.agregarTaller({
    id: 't1',
    usuarioId: 'taller',
    nombre: 'Taller',
    direccion: null,
    telefono: null,
    activo: true,
  });
  const deps = {
    repositorio,
    baremo,
    ordenes,
    almacen: new InMemoryStorageService(),
    auditoria: new InMemoryAuditRepository(),
    reloj: clockFijo(new Date('2026-10-21T12:00:00Z')),
    limitadorRpm: new TokenBucketRateLimiter(10, 10),
    proveedorIa: new MockProvider('leve-faro'),
  };
  const vehiculo = await repositorio.crearVehiculo({
    aseguradoId: 'dueno',
    matricula: 'ABC',
    marca: 'Toyota',
    modelo: 'Yaris',
    numeroPoliza: 'P1',
  });
  const siniestro = await createClaim(deps, {
    aseguradoId: 'dueno',
    vehiculoId: vehiculo.id,
    descripcion: null,
    latitud: 0,
    longitud: 0,
    fechaIncidente: '2026-10-21T11:50:00Z',
  });
  const imagen = await uploadImage(
    {
      ...deps,
      imagenes: {
        calcularDHash: async () => 'aaaaaaaaaaaaaaaa',
        esArchivoNoEnVivo: async () => false,
      },
    },
    {
      siniestroId: siniestro.id,
      aseguradoId: 'dueno',
      archivo: Buffer.from('jpeg-simulado'),
      tipoMime: 'image/jpeg',
      capturadaEn: '2026-10-21T11:59:00Z',
      latitud: 0,
      longitud: 0,
      precisionGpsM: 10,
      orden: 0,
      rostrosDifuminados: true,
      userAgent: null,
    },
  );
  return { deps, siniestro, imagen };
}

describe('flujo local de los sprints 2 a 4', () => {
  it('debería completar la ruta verde desde el alta hasta la reparación', async () => {
    const { deps, siniestro, imagen } = await preparar();
    const resultado = await analyzeClaim(deps, siniestro.id, 'dueno');
    expect(resultado).toMatchObject({ ruta: 'VERDE', costoTotalUsd: 150 });
    const detalle = await getClaim(deps, siniestro.id, 'dueno', 'ASEGURADO');
    expect(detalle.evaluaciones[0]).toMatchObject({ imagenId: imagen.id, costoPiezaEstimado: 150 });
    expect(detalle.orden?.montoAutorizado).toBe(150);
    for (const nuevoEstado of ['RECIBIDO', 'EN_REPARACION', 'COMPLETADO'] as const) {
      await updateWorkOrder(deps, {
        ordenId: detalle.orden!.id,
        usuarioTaller: 'taller',
        nuevoEstado,
      });
    }
    expect((await getClaim(deps, siniestro.id, 'dueno', 'ASEGURADO')).siniestro?.estado).toBe(
      'FINALIZADO',
    );
    expect(
      deps.auditoria.todos().filter((r) => r.accion === 'ESTADO_ORDEN_ACTUALIZADO'),
    ).toHaveLength(3);
  });

  it('debería degradar por cuota y recuperarse mediante reanálisis sin borrar la inspección', async () => {
    const { deps, siniestro } = await preparar();
    await analyzeClaim(
      { ...deps, proveedorIa: new MockProvider('cuota-agotada') },
      siniestro.id,
      'dueno',
    );
    const anterior = await getClaim(deps, siniestro.id, 'dueno', 'ASEGURADO');
    expect(anterior.siniestro).toMatchObject({ estado: 'EN_REVISION', ruta: 'AMARILLA' });
    expect(anterior.siniestro?.etiquetas).toContain('IA_NO_DISPONIBLE');
    expect(anterior.orden).toBeNull();
    await reanalyzeClaim(deps, siniestro.id, 'perito');
    await analyzeClaim(deps, siniestro.id, 'dueno');
    const nuevo = await getClaim(deps, siniestro.id, 'dueno', 'ASEGURADO');
    expect(nuevo.siniestro?.ruta).toBe('VERDE');
    expect(nuevo.inspeccion?.id).not.toBe(anterior.inspeccion?.id);
    expect(await deps.repositorio.contarInspeccionesDigitalIaHoy(deps.reloj.ahora())).toBe(2);
  });

  it('debería requerir al perito en ruta roja y crear la orden solo tras aprobar', async () => {
    const { deps, siniestro } = await preparar();
    await analyzeClaim(
      { ...deps, proveedorIa: new MockProvider('recaptura') },
      siniestro.id,
      'dueno',
    );
    const detalle = await getClaim(deps, siniestro.id, 'perito', 'PERITO');
    expect(detalle.siniestro).toMatchObject({
      ruta: 'ROJA',
      estado: 'EN_REVISION',
      requiereInspeccionPresencial: true,
    });
    expect(detalle.orden).toBeNull();
    await issueVerdict(deps, {
      siniestroId: siniestro.id,
      peritoId: 'perito',
      dictamenFinal: 'APROBADO',
      observacionesPerito: 'Inspección presencial realizada',
    });
    expect((await getClaim(deps, siniestro.id, 'dueno', 'ASEGURADO')).orden).not.toBeNull();
  });

  it('debería impedir al asegurado ajeno leer o analizar el caso', async () => {
    const { deps, siniestro } = await preparar();
    await expect(getClaim(deps, siniestro.id, 'otro', 'ASEGURADO')).rejects.toMatchObject({
      status: 403,
    });
    await expect(analyzeClaim(deps, siniestro.id, 'otro')).rejects.toMatchObject({ status: 403 });
    expect((await deps.repositorio.obtenerSiniestroPorId(siniestro.id))?.estado).toBe('PENDIENTE');
    expect(deps.auditoria.todos()).toHaveLength(0);
  });
});
