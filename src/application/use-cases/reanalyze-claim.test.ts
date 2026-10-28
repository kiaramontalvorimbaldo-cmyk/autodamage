import { describe, expect, it } from 'vitest';
import { reanalyzeClaim } from './reanalyze-claim';
import { InMemoryClaimRepository } from '@/infrastructure/repositories/in-memory-claim-repository';
import { InMemoryAuditRepository } from '@/infrastructure/repositories/in-memory-audit-repository';

describe('reanalyzeClaim', () => {
  it('prepara el reanálisis cuando hay etiqueta IA_NO_DISPONIBLE', async () => {
    const repositorio = new InMemoryClaimRepository();
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
      estado: 'EN_REVISION',
      analisisEstado: 'COMPLETADO',
      etiquetas: ['IA_NO_DISPONIBLE'],
    });

    await repositorio.crearImagen({
      id: 'img',
      siniestroId: siniestro.id,
      storagePath: 'img.jpg',
      hashPerceptual: 'aaaaaaaaaaaaaaaa',
      capturadaEn: '2026-10-01T00:00:00Z',
      latitud: null,
      longitud: null,
      precisionGpsM: null,
      userAgent: null,
      orden: 0,
      rostrosDifuminados: true,
    });
    await reanalyzeClaim({ repositorio, auditoria }, siniestro.id, 'perito-1');

    const actualizado = await repositorio.obtenerSiniestroPorId(siniestro.id);
    expect(actualizado?.analisisEstado).toBe('EN_PROCESO');
    expect(actualizado?.etiquetas).toEqual(['IA_NO_DISPONIBLE']);
    expect(auditoria.todos().some((r) => r.accion === 'REANALISIS_SOLICITADO')).toBe(true);
  });

  it('rechaza cuando el siniestro está sano', async () => {
    const repositorio = new InMemoryClaimRepository();
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
      analisisEstado: 'COMPLETADO',
    });

    await expect(
      reanalyzeClaim({ repositorio, auditoria }, siniestro.id, 'perito-1'),
    ).rejects.toMatchObject({code:'REANALISIS_NO_PERMITIDO'});
  });
});
