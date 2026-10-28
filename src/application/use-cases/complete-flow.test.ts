import { describe, it, expect, vi } from 'vitest';
import { InMemoryClaimRepository } from '@/infrastructure/repositories/in-memory-claim-repository';
import { InMemoryAuditRepository } from '@/infrastructure/repositories/in-memory-audit-repository';
import { createClaim } from './create-claim';
import { getAmendment, submitAmendment } from './claim-amendment';
import { uploadImage } from './upload-image';
import { workflowError } from '@/infrastructure/supabase/workflow-error';
import { reanalyzeClaim } from './reanalyze-claim';
async function preparar() {
  const repositorio = new InMemoryClaimRepository(),
    auditoria = new InMemoryAuditRepository();
  const vehiculo = await repositorio.crearVehiculo({
    aseguradoId: 'a',
    matricula: 'ABC',
    marca: 'Toyota',
    modelo: 'Yaris',
    numeroPoliza: 'P',
  });
  const input = {
    id: 'caso-estable',
    aseguradoId: 'a',
    vehiculoId: vehiculo.id,
    descripcion: 'Daño lateral',
    latitud: 0,
    longitud: 0,
    fechaIncidente: '2026-10-27T12:00:00Z',
  };
  const reloj = { ahora: () => new Date('2026-10-27T12:00:00Z') };
  const caso = await createClaim({ repositorio, reloj }, input);
  const imagenes = {
    esArchivoNoEnVivo: vi.fn(async () => false),
    calcularDHash: vi.fn(async () => '0123456789abcdef'),
  };
  const almacen = {
    subir: vi.fn(async () => undefined),
    eliminar: vi.fn(async () => undefined),
    descargar: vi.fn(async () => Buffer.from('foto')),
    urlFirmado: vi.fn(async () => '/foto'),
  };
  return { repositorio, auditoria, input, reloj, caso, imagenes, almacen };
}
async function pedirAmpliacion() {
  const ctx = await preparar();
  const i = await ctx.repositorio.crearInspeccion({
    siniestroId: ctx.caso.id,
    tipoInspeccion: 'DIGITAL_IA',
    verdictFraude: 'SIN_RIESGO',
    indicadoresFraude: [],
    nivelSeveridad: 'LEVE',
    costoTotalEstimado: 0,
    confianzaGlobal: 0.2,
    modeloIa: 'mock',
    versionPrompt: 'mock-v1',
    respuestaIa: null,
  });
  await ctx.repositorio.actualizarSiniestro(ctx.caso.id, {
    estado: 'EN_REVISION',
    analisisEstado: 'COMPLETADO',
  });
  await ctx.repositorio.actualizarInspeccionDictamen(i.id, {
    peritoId: 'p',
    dictamenFinal: 'AMPLIACION_REQUERIDA',
    observacionesPerito: 'Foto del lateral',
    kilometraje: null,
    costoTotalEstimado: 0,
  });
  await ctx.auditoria.registrar({
    entidad: 'siniestros',
    entidadId: ctx.caso.id,
    accion: 'DICTAMEN_REGISTRADO',
    actorTipo: 'USUARIO',
    actorId: 'p',
    datos: { dictamenFinal: 'AMPLIACION_REQUERIDA' },
  });
  return ctx;
}
const entrada = (id: string) => ({
  siniestroId: id,
  aseguradoId: 'a',
  archivo: Buffer.from('foto'),
  tipoMime: 'image/jpeg',
  capturadaEn: '2026-10-27T12:00:00Z',
  latitud: null,
  longitud: null,
  precisionGpsM: null,
  orden: 0,
  rostrosDifuminados: true,
  userAgent: null,
  imagenId: 'foto-estable',
});
describe('recuperación del recorrido completo', () => {
  it('debería permitir al perito analizar la ampliación recibida aunque la IA anterior no falló', async () => {
    const ctx = await pedirAmpliacion();
    const a = await getAmendment(ctx, ctx.caso.id);
    await uploadImage(ctx, { ...entrada(ctx.caso.id), ampliacionId: a!.id });
    await submitAmendment(ctx, ctx.caso.id, 'a', a!.id);
    await reanalyzeClaim(ctx, ctx.caso.id, 'p');
    expect((await ctx.repositorio.obtenerSiniestroPorId(ctx.caso.id))?.analisisEstado).toBe(
      'EN_PROCESO',
    );
  });
  it('debería recuperar una carga de Storage cuya respuesta se perdió', async () => {
    const ctx = await preparar();
    ctx.almacen.subir.mockRejectedValueOnce(new Error('respuesta perdida'));
    await uploadImage(ctx, entrada(ctx.caso.id));
    expect(await ctx.repositorio.contarImagenes(ctx.caso.id)).toBe(1);
  });
  it('debería rechazar otro contenido con el mismo identificador de foto', async () => {
    const ctx = await preparar();
    await uploadImage(ctx, entrada(ctx.caso.id));
    await expect(
      uploadImage(ctx, { ...entrada(ctx.caso.id), archivo: Buffer.from('otra') }),
    ).rejects.toMatchObject({ code: 'SOLICITUD_CONFLICTIVA' });
  });
  it('debería recuperar una fila confirmada sin borrar la foto si se pierde la respuesta', async () => {
    const ctx = await preparar();
    const original = ctx.repositorio.crearImagen.bind(ctx.repositorio);
    vi.spyOn(ctx.repositorio, 'crearImagen').mockImplementation(async (input) => {
      await original(input);
      throw new Error('respuesta perdida');
    });
    await uploadImage(ctx, entrada(ctx.caso.id));
    expect(ctx.almacen.eliminar).not.toHaveBeenCalled();
  });
  it('debería evitar borrar el archivo si no puede comprobar la confirmación', async () => {
    const ctx = await preparar();
    vi.spyOn(ctx.repositorio, 'crearImagen').mockRejectedValue(new Error('respuesta perdida'));
    vi.spyOn(ctx.repositorio, 'listarImagenes')
      .mockResolvedValueOnce([])
      .mockRejectedValue(new Error('sin conexión'));
    await expect(uploadImage(ctx, entrada(ctx.caso.id))).rejects.toMatchObject({
      code: 'EVIDENCIA_LIMPIEZA_PENDIENTE',
    });
    expect(ctx.almacen.eliminar).not.toHaveBeenCalled();
  });
  it('debería reutilizar el reporte tras perderse la respuesta de creación', async () => {
    const ctx = await preparar();
    const r = await createClaim(ctx, ctx.input);
    expect(r.id).toBe(ctx.caso.id);
    expect(await ctx.repositorio.listarTodosLosSiniestros()).toHaveLength(1);
  });
  it('debería impedir reutilizar el identificador para otro contenido o asegurado', async () => {
    const ctx = await preparar();
    await expect(createClaim(ctx, { ...ctx.input, descripcion: 'Otro' })).rejects.toMatchObject({
      code: 'SOLICITUD_CONFLICTIVA',
    });
  });
  it('debería repetir una carga sin duplicar la foto ni el archivo', async () => {
    const ctx = await preparar();
    await uploadImage(ctx, entrada(ctx.caso.id));
    await uploadImage(ctx, entrada(ctx.caso.id));
    expect(await ctx.repositorio.contarImagenes(ctx.caso.id)).toBe(1);
    expect(ctx.almacen.subir).toHaveBeenCalledTimes(1);
  });
  it('debería entregar nuevas evidencias y mantener revisión humana', async () => {
    const ctx = await pedirAmpliacion();
    const a = await getAmendment(ctx, ctx.caso.id);
    expect(a?.entregada).toBe(false);
    await uploadImage(ctx, { ...entrada(ctx.caso.id), ampliacionId: a!.id });
    await submitAmendment(ctx, ctx.caso.id, 'a', a!.id);
    await submitAmendment(ctx, ctx.caso.id, 'a', a!.id);
    expect((await getAmendment(ctx, ctx.caso.id))?.entregada).toBe(true);
    expect(ctx.auditoria.todos().filter((r) => r.accion === 'AMPLIACION_ENTREGADA')).toHaveLength(
      1,
    );
    expect((await ctx.repositorio.obtenerSiniestroPorId(ctx.caso.id))?.estado).toBe('EN_REVISION');
  });
  it('debería impedir una respuesta ajena o sin fotos', async () => {
    const ctx = await pedirAmpliacion();
    const a = await getAmendment(ctx, ctx.caso.id);
    await expect(submitAmendment(ctx, ctx.caso.id, 'otro', a!.id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(submitAmendment(ctx, ctx.caso.id, 'a', a!.id)).rejects.toMatchObject({
      code: 'SIN_IMAGENES',
    });
  });
  it('debería cerrar la carga de la ampliación entregada', async () => {
    const ctx = await pedirAmpliacion();
    const a = await getAmendment(ctx, ctx.caso.id);
    await uploadImage(ctx, { ...entrada(ctx.caso.id), ampliacionId: a!.id });
    await submitAmendment(ctx, ctx.caso.id, 'a', a!.id);
    await expect(
      uploadImage(ctx, { ...entrada(ctx.caso.id), imagenId: 'otra', ampliacionId: a!.id }),
    ).rejects.toMatchObject({ code: 'ESTADO_INVALIDO' });
  });
  it('debería avisar de migración pendiente sin volver a escrituras parciales', () => {
    expect(() => workflowError({ code: 'PGRST202', message: 'missing function' })).toThrow(
      /migración 005/,
    );
  });
});
