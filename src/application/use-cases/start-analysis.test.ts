import { describe, expect, it, vi } from 'vitest';
import { startAnalysis } from './start-analysis';
import { reanalyzeClaim } from './reanalyze-claim';
import { InMemoryClaimRepository } from '@/infrastructure/repositories/in-memory-claim-repository';
import { InMemoryAuditRepository } from '@/infrastructure/repositories/in-memory-audit-repository';

async function preparar() {
  const repositorio = new InMemoryClaimRepository();
  const auditoria = new InMemoryAuditRepository();
  const s = await repositorio.crearSiniestro({
    aseguradoId: 'dueno',
    vehiculoId: 'vehiculo',
    descripcion: null,
    latitud: 0,
    longitud: 0,
    fechaIncidente: '2026-10-21T00:00:00Z',
    fechaRegistro: '2026-10-21T00:00:00Z',
  });
  await repositorio.crearImagen({
    id: 'img',
    siniestroId: s.id,
    storagePath: 'img.jpg',
    hashPerceptual: 'aaaaaaaaaaaaaaaa',
    capturadaEn: '2026-10-21T00:00:00Z',
    latitud: null,
    longitud: null,
    precisionGpsM: null,
    userAgent: null,
    orden: 0,
    rostrosDifuminados: true,
  });
  const [foto] = await repositorio.listarImagenes(s.id);
  for (let n = 1; n < 3; n++) await repositorio.crearImagen({ ...foto, id: `img-${n}`, orden: n });
  return { repositorio, auditoria, id: s.id };
}

describe('reserva del análisis', () => {
  it.each([1, 2])(
    'debería bloquear el análisis inicial con solo %s fotos incluso por API',
    async (cantidad) => {
      const ctx = await preparar();
      vi.spyOn(ctx.repositorio, 'contarImagenes').mockResolvedValue(cantidad);
      await expect(startAnalysis(ctx.repositorio, ctx.id, 'dueno')).rejects.toMatchObject({
        code: 'FOTOS_INSUFICIENTES',
      });
      expect((await ctx.repositorio.obtenerSiniestroPorId(ctx.id))?.analisisEstado).toBe(
        'NO_INICIADO',
      );
    },
  );
  it('debería aceptar solo una de dos solicitudes simultáneas', async () => {
    const ctx = await preparar();
    const resultados = await Promise.allSettled([
      startAnalysis(ctx.repositorio, ctx.id, 'dueno'),
      startAnalysis(ctx.repositorio, ctx.id, 'dueno'),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await ctx.repositorio.obtenerSiniestroPorId(ctx.id))?.analisisEstado).toBe(
      'EN_PROCESO',
    );
  });

  it('debería impedir reservar un caso ajeno', async () => {
    const ctx = await preparar();
    await expect(startAnalysis(ctx.repositorio, ctx.id, 'otro')).rejects.toMatchObject({
      status: 403,
    });
    expect((await ctx.repositorio.obtenerSiniestroPorId(ctx.id))?.analisisEstado).toBe(
      'NO_INICIADO',
    );
  });

  it('debería impedir análisis sin imágenes', async () => {
    const ctx = await preparar();
    vi.spyOn(ctx.repositorio, 'contarImagenes').mockResolvedValue(0);
    await expect(startAnalysis(ctx.repositorio, ctx.id, 'dueno')).rejects.toMatchObject({
      code: 'SIN_IMAGENES',
    });
  });

  it('debería reservar solo un reanálisis y conservar señales durante el proceso', async () => {
    const ctx = await preparar();
    await ctx.repositorio.actualizarSiniestro(ctx.id, {
      estado: 'EN_REVISION',
      analisisEstado: 'COMPLETADO',
      etiquetas: ['IA_NO_DISPONIBLE'],
    });
    const resultados = await Promise.allSettled([
      reanalyzeClaim(ctx, ctx.id, 'perito'),
      reanalyzeClaim(ctx, ctx.id, 'perito'),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(ctx.auditoria.todos()).toHaveLength(1);
    expect((await ctx.repositorio.obtenerSiniestroPorId(ctx.id))?.etiquetas).toContain(
      'IA_NO_DISPONIBLE',
    );
  });

  it.each(['APROBADO', 'RECHAZADO', 'FINALIZADO'] as const)(
    'debería impedir reanalizar una decisión final %s',
    async (estado) => {
      const ctx = await preparar();
      await ctx.repositorio.actualizarSiniestro(ctx.id, { estado, analisisEstado: 'FALLIDO' });
      await expect(reanalyzeClaim(ctx, ctx.id, 'perito')).rejects.toMatchObject({
        code: 'REANALISIS_NO_PERMITIDO',
      });
      expect(ctx.auditoria.todos()).toHaveLength(0);
    },
  );

  it('debería liberar la reserva como FALLIDO si no se puede auditar', async () => {
    const ctx = await preparar();
    await ctx.repositorio.actualizarSiniestro(ctx.id, { analisisEstado: 'FALLIDO' });
    vi.spyOn(ctx.auditoria, 'registrar').mockRejectedValue(new Error('sin auditoría'));
    await expect(reanalyzeClaim(ctx, ctx.id, 'perito')).rejects.toThrow('sin auditoría');
    expect((await ctx.repositorio.obtenerSiniestroPorId(ctx.id))?.analisisEstado).toBe('FALLIDO');
  });
});
