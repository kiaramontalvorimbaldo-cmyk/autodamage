import { describe, expect, it } from 'vitest';
import { analyzeClaim } from './analyze-claim';
import { InMemoryClaimRepository } from '@/infrastructure/repositories/in-memory-claim-repository';
import { InMemoryBaremoRepository } from '@/infrastructure/repositories/in-memory-baremo-repository';
import { InMemoryAuditRepository } from '@/infrastructure/repositories/in-memory-audit-repository';
import { InMemoryStorageService } from '@/infrastructure/storage/in-memory-storage';
import { MockProvider } from '@/infrastructure/ai/mock-provider';
import { TokenBucketRateLimiter } from '@/infrastructure/ai/rate-limiter';
import { clockFijo } from '@/application/ports/clock';
import type { AiProvider } from '@/application/ports/ai-provider';

const USUARIO = '00000000-0000-0000-0000-000000000001';
const OTRO_USUARIO = '00000000-0000-0000-0000-000000000002';
const VEHICULO = '00000000-0000-0000-0000-000000000003';
const AHORA = new Date('2026-01-15T12:00:00Z');
const CAPTURADA = '2026-01-15T11:55:00Z';
const LATITUD = 19.4326;
const LONGITUD = -99.1332;

/** Baremo mínimo: FARO_DEL_IZQ 120+1h×30=150 al sustituir; ESPEJO_IZQ 0.5h×30=15 al reparar. */
function baremoDePrueba() {
  const baremo = new InMemoryBaremoRepository();
  baremo.definir('FARO_DEL_IZQ', {
    costo_repuesto_base: 120,
    horas_mano_obra: 1.0,
    costo_hora_mo: 30,
  });
  baremo.definir('ESPEJO_IZQ', {
    costo_repuesto_base: 60,
    horas_mano_obra: 0.5,
    costo_hora_mo: 30,
  });
  baremo.definir('PUERTA_DEL_IZQ', {
    costo_repuesto_base: 300,
    horas_mano_obra: 3.5,
    costo_hora_mo: 30,
  });
  baremo.definir('GUARDABARRO_DEL_IZQ', {
    costo_repuesto_base: 140,
    horas_mano_obra: 2,
    costo_hora_mo: 30,
  });
  return baremo;
}

/** Crea un siniestro con una imagen listo para analizar. */
async function crearSiniestroConImagen(
  repositorio: InMemoryClaimRepository,
  almacen: InMemoryStorageService,
  aseguradoId = USUARIO,
  hashPerceptual = 'A'.repeat(16),
): Promise<string> {
  const siniestro = await repositorio.crearSiniestro({
    aseguradoId,
    vehiculoId: VEHICULO,
    descripcion: null,
    latitud: LATITUD,
    longitud: LONGITUD,
    fechaIncidente: '2026-01-15T11:50:00Z',
    fechaRegistro: '2026-01-15T11:56:00Z',
  });
  const imagenId = crypto.randomUUID();
  await almacen.subir({
    camino: `${siniestro.id}/${imagenId}.jpg`,
    contenido: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    tipoMime: 'image/jpeg',
  });
  await repositorio.crearImagen({
    id: imagenId,
    siniestroId: siniestro.id,
    storagePath: `${siniestro.id}/${imagenId}.jpg`,
    hashPerceptual,
    capturadaEn: CAPTURADA,
    latitud: LATITUD,
    longitud: LONGITUD,
    precisionGpsM: 10,
    userAgent: null,
    orden: 0,
    rostrosDifuminados: true,
  });
  return siniestro.id;
}

function depsDePrueba(
  escenario:
    | 'leve-faro'
    | 'moderado-puerta'
    | 'baja-confianza'
    | 'recaptura'
    | 'sin-piezas'
    | 'cuota-agotada'
    | 'json-invalido' = 'leve-faro',
  sobreescribir: Partial<{
    repositorio: InMemoryClaimRepository;
    baremo: InMemoryBaremoRepository;
    almacen: InMemoryStorageService;
    proveedorIa: AiProvider;
    limitadorRpm: TokenBucketRateLimiter;
    auditoria: InMemoryAuditRepository;
  }> = {},
) {
  const repositorio = sobreescribir.repositorio ?? new InMemoryClaimRepository();
  return {
    repositorio,
    baremo: sobreescribir.baremo ?? baremoDePrueba(),
    almacen: sobreescribir.almacen ?? new InMemoryStorageService(),
    proveedorIa: sobreescribir.proveedorIa ?? new MockProvider(escenario),
    limitadorRpm: sobreescribir.limitadorRpm ?? new TokenBucketRateLimiter(10, 10),
    auditoria: sobreescribir.auditoria ?? new InMemoryAuditRepository(),
    reloj: clockFijo(AHORA),
  };
}

describe('analyzeClaim', () => {
  it('debería comparar la captura contra su recepción y no contra el día del reanálisis', async () => {
    const deps = depsDePrueba('leve-faro');
    const id = await crearSiniestroConImagen(deps.repositorio, deps.almacen);
    const [foto] = await deps.repositorio.listarImagenes(id);
    foto.recibidaEn = AHORA.toISOString();
    deps.reloj = clockFijo(new Date('2026-02-15T12:00:00Z'));
    expect((await analyzeClaim(deps, id, USUARIO)).ruta).toBe('VERDE');
  });
  it('debería actualizar las piezas de una ampliación sin aprobarla automáticamente', async () => {
    const deps = depsDePrueba('leve-faro');
    const id = await crearSiniestroConImagen(deps.repositorio, deps.almacen);
    await deps.repositorio.actualizarSiniestro(id, {
      estado: 'EN_REVISION',
      analisisEstado: 'EN_PROCESO',
      etiquetas: ['AMPLIACION_RECIBIDA'],
    });
    const resultado = await analyzeClaim(deps, id, USUARIO);
    expect(resultado).toMatchObject({ ruta: 'AMARILLA', estado: 'EN_REVISION', piezasValidas: 1 });
  });
  it('debería conservar la evidencia correcta tras descartar códigos desconocidos y repetir piezas', async () => {
    const original = await new MockProvider('leve-faro').analizarDanos({
      imagenes: [],
      codigosPiezasValidos: [],
    });
    const pieza = original.piezas_detectadas[0];
    const proveedorIa: AiProvider = {
      versionPrompt: 'v1',
      analizarDanos: async () => ({
        ...original,
        piezas_detectadas: [
          { ...pieza, codigo_pieza: 'INVENTADA', confianza: 0.1 },
          { ...pieza, confianza: 0.8, bbox: [10, 20, 30, 40], imagen_indice: 0 },
          { ...pieza, confianza: 0.9, bbox: [50, 60, 70, 80], imagen_indice: 1 },
        ],
      }),
    };
    const deps = depsDePrueba('leve-faro', { proveedorIa });
    const id = await crearSiniestroConImagen(deps.repositorio, deps.almacen);
    const [primera] = await deps.repositorio.listarImagenes(id);
    const segunda = await deps.repositorio.crearImagen({
      ...primera,
      id: crypto.randomUUID(),
      orden: 1,
    });
    const resultado = await analyzeClaim(deps, id, USUARIO);
    const inspeccion = await deps.repositorio.obtenerInspeccionPorSiniestro(id);
    const evaluaciones = await deps.repositorio.listarEvaluacionesPorInspeccion(inspeccion!.id);
    expect(resultado.etiquetas).toContain('CODIGOS_DESCONOCIDOS');
    expect(resultado.costoTotalUsd).toBe(300);
    expect(evaluaciones).toMatchObject([
      { confianza: 0.8, bbox: [10, 20, 30, 40], imagenId: primera.id },
      { confianza: 0.9, bbox: [50, 60, 70, 80], imagenId: segunda.id },
    ]);
  });

  it('flujo VERDE: siniestro LEVE con costo < 500 → FAST_TRACK', async () => {
    const deps = depsDePrueba('leve-faro');
    const siniestroId = await crearSiniestroConImagen(deps.repositorio, deps.almacen);

    const resultado = await analyzeClaim(deps, siniestroId, USUARIO);

    expect(resultado.ruta).toBe('VERDE');
    expect(resultado.estado).toBe('FAST_TRACK');
    expect(resultado.costoTotalUsd).toBe(150); // 120 repuesto + 1h × 30
    expect(resultado.piezasValidas).toBe(1);

    const siniestro = await deps.repositorio.obtenerSiniestroPorId(siniestroId);
    expect(siniestro?.estado).toBe('FAST_TRACK');
    expect(siniestro?.ruta).toBe('VERDE');
    expect(siniestro?.analisisEstado).toBe('COMPLETADO');
    expect(siniestro?.requiereInspeccionPresencial).toBe(false);
    expect(siniestro?.etiquetas).toEqual([]);

    const inspeccion = await deps.repositorio.obtenerInspeccionPorSiniestro(siniestroId);
    expect(inspeccion?.verdictFraude).toBe('SIN_RIESGO');
    expect(inspeccion?.indicadoresFraude).toEqual([]);
    expect(inspeccion?.tipoInspeccion).toBe('DIGITAL_IA');
    expect(inspeccion?.nivelSeveridad).toBe('LEVE');
    expect(inspeccion?.costoTotalEstimado).toBe(150);
    expect(inspeccion?.confianzaGlobal).toBe(0.93);
    expect(inspeccion?.modeloIa).toBe('mock');
    expect(inspeccion?.versionPrompt).toBe('mock-v1');
    expect(inspeccion?.respuestaIa).not.toBeNull();

    const evaluaciones = await deps.repositorio.listarEvaluacionesPorInspeccion(inspeccion!.id);
    expect(evaluaciones).toHaveLength(1);
    expect(evaluaciones[0].codigoPieza).toBe('FARO_DEL_IZQ');
    expect(evaluaciones[0].accionRequerida).toBe('SUSTITUIR');
    expect(evaluaciones[0].costoPiezaEstimado).toBe(150);
    expect(evaluaciones[0].horasManoObra).toBe(1);
    expect(evaluaciones[0].confianza).toBe(0.95);

    // Auditoría: la IA y el sistema dejan rastro
    const registros = deps.auditoria.todos();
    expect(
      registros.some((r) => r.accion === 'ANALISIS_IA_COMPLETADO' && r.actorTipo === 'IA'),
    ).toBe(true);
    expect(registros.some((r) => r.accion === 'TRIAJE_DECIDIDO' && r.actorTipo === 'SISTEMA')).toBe(
      true,
    );
  });

  it('AMARILLA por baja confianza global (< 0.6)', async () => {
    const deps = depsDePrueba('baja-confianza');
    const siniestroId = await crearSiniestroConImagen(deps.repositorio, deps.almacen);

    const resultado = await analyzeClaim(deps, siniestroId, USUARIO);

    expect(resultado.ruta).toBe('AMARILLA');
    expect(resultado.estado).toBe('EN_REVISION');
    expect(resultado.etiquetas).toContain('BAJA_CONFIANZA');
    expect(resultado.costoTotalUsd).toBe(15); // ESPEJO_IZQ reparar: 0.5h × 30
  });

  it('AMARILLA por severidad MODERADO', async () => {
    const deps = depsDePrueba('moderado-puerta');
    const siniestroId = await crearSiniestroConImagen(deps.repositorio, deps.almacen);

    const resultado = await analyzeClaim(deps, siniestroId, USUARIO);

    expect(resultado.ruta).toBe('AMARILLA');
    expect(resultado.estado).toBe('EN_REVISION');
    expect(resultado.piezasValidas).toBe(2);
    // PUERTA 3.5h×30=105 (REPARAR) + GUARDABARRO 2h×0.6×30=36 (PINTAR) = 141
    expect(resultado.costoTotalUsd).toBe(141);
  });

  it('AMARILLA sin piezas válidas detectadas', async () => {
    const deps = depsDePrueba('sin-piezas');
    const siniestroId = await crearSiniestroConImagen(deps.repositorio, deps.almacen);

    const resultado = await analyzeClaim(deps, siniestroId, USUARIO);

    expect(resultado.ruta).toBe('AMARILLA');
    expect(resultado.etiquetas).toContain('SIN_PIEZAS_VALIDAS');
    expect(resultado.piezasValidas).toBe(0);
  });

  it('ROJA por sospecha de recaptura de la IA → inspección presencial', async () => {
    const deps = depsDePrueba('recaptura');
    const siniestroId = await crearSiniestroConImagen(deps.repositorio, deps.almacen);

    const resultado = await analyzeClaim(deps, siniestroId, USUARIO);

    expect(resultado.ruta).toBe('ROJA');
    expect(resultado.estado).toBe('EN_REVISION');
    const siniestro = await deps.repositorio.obtenerSiniestroPorId(siniestroId);
    expect(siniestro?.requiereInspeccionPresencial).toBe(true);

    const inspeccion = await deps.repositorio.obtenerInspeccionPorSiniestro(siniestroId);
    expect(inspeccion?.tipoInspeccion).toBe('PRESENCIAL');
    expect(inspeccion?.verdictFraude).toBe('SOSPECHA_RECAPTURA');
    expect(inspeccion?.indicadoresFraude).toContain('SOSPECHA_RECAPTURA');
  });

  it('ROJA por foto duplicada de OTRO siniestro (dHash igual)', async () => {
    const repositorio = new InMemoryClaimRepository();
    const almacen = new InMemoryStorageService();
    // Primer siniestro con hash X
    await crearSiniestroConImagen(repositorio, almacen, USUARIO, 'ABCD'.repeat(4));
    // Segundo siniestro con el MISMO hash → duplicado del primero
    const deps = depsDePrueba('leve-faro', { repositorio, almacen });
    const segundoId = await crearSiniestroConImagen(
      repositorio,
      almacen,
      USUARIO,
      'ABCD'.repeat(4),
    );

    const resultado = await analyzeClaim(deps, segundoId, USUARIO);

    expect(resultado.ruta).toBe('ROJA');
    const inspeccion = await deps.repositorio.obtenerInspeccionPorSiniestro(segundoId);
    expect(inspeccion?.verdictFraude).toBe('FOTO_DUPLICADA');
  });

  it('NO marca duplicado contra imágenes del MISMO siniestro', async () => {
    const deps = depsDePrueba('leve-faro');
    const siniestroId = await crearSiniestroConImagen(
      deps.repositorio,
      deps.almacen,
      USUARIO,
      'EEEE'.repeat(4),
    );
    // Segunda imagen del mismo siniestro con el mismo hash
    await deps.repositorio.crearImagen({
      id: crypto.randomUUID(),
      siniestroId,
      storagePath: `${siniestroId}/segunda.jpg`,
      hashPerceptual: 'EEEE'.repeat(4),
      capturadaEn: CAPTURADA,
      latitud: LATITUD,
      longitud: LONGITUD,
      precisionGpsM: 10,
      userAgent: null,
      orden: 1,
      rostrosDifuminados: true,
    });
    await deps.almacen.subir({
      camino: `${siniestroId}/segunda.jpg`,
      contenido: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      tipoMime: 'image/jpeg',
    });

    const resultado = await analyzeClaim(deps, siniestroId, USUARIO);

    expect(resultado.ruta).toBe('VERDE');
    const inspeccion = await deps.repositorio.obtenerInspeccionPorSiniestro(siniestroId);
    expect(inspeccion?.verdictFraude).toBe('SIN_RIESGO');
  });

  it('ROJA por inconsistencia GPS (foto lejos del siniestro)', async () => {
    const deps = depsDePrueba('leve-faro');
    const repositorio = deps.repositorio;
    const siniestro = await repositorio.crearSiniestro({
      aseguradoId: USUARIO,
      vehiculoId: VEHICULO,
      descripcion: null,
      latitud: LATITUD,
      longitud: LONGITUD,
      fechaIncidente: '2026-01-15T11:50:00Z',
      fechaRegistro: '2026-01-15T11:56:00Z',
    });
    await deps.almacen.subir({
      camino: `${siniestro.id}/img.jpg`,
      contenido: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      tipoMime: 'image/jpeg',
    });
    await repositorio.crearImagen({
      id: crypto.randomUUID(),
      siniestroId: siniestro.id,
      storagePath: `${siniestro.id}/img.jpg`,
      hashPerceptual: 'F'.repeat(16),
      capturadaEn: CAPTURADA,
      // A ~5 km del siniestro (Madrid centro → distinto barrio)
      latitud: 19.4736,
      longitud: -99.1332,
      precisionGpsM: 10,
      userAgent: null,
      orden: 0,
      rostrosDifuminados: true,
    });

    const resultado = await analyzeClaim(deps, siniestro.id, USUARIO);

    expect(resultado.ruta).toBe('ROJA');
    const inspeccion = await deps.repositorio.obtenerInspeccionPorSiniestro(siniestro.id);
    expect(inspeccion?.verdictFraude).toBe('INCONSISTENCIA_GPS');
  });

  it('ROJA por inconsistencia temporal (captura muy vieja)', async () => {
    const deps = depsDePrueba('leve-faro');
    const siniestro = await deps.repositorio.crearSiniestro({
      aseguradoId: USUARIO,
      vehiculoId: VEHICULO,
      descripcion: null,
      latitud: LATITUD,
      longitud: LONGITUD,
      fechaIncidente: '2026-01-15T11:50:00Z',
      fechaRegistro: '2026-01-15T11:56:00Z',
    });
    await deps.almacen.subir({
      camino: `${siniestro.id}/img.jpg`,
      contenido: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      tipoMime: 'image/jpeg',
    });
    await deps.repositorio.crearImagen({
      id: crypto.randomUUID(),
      siniestroId: siniestro.id,
      storagePath: `${siniestro.id}/img.jpg`,
      hashPerceptual: 'B'.repeat(16),
      // Capturada hace 2 horas (más de 15 min)
      capturadaEn: '2026-01-15T10:00:00Z',
      latitud: LATITUD,
      longitud: LONGITUD,
      precisionGpsM: 10,
      userAgent: null,
      orden: 0,
      rostrosDifuminados: true,
    });

    const resultado = await analyzeClaim(deps, siniestro.id, USUARIO);

    expect(resultado.ruta).toBe('ROJA');
    const inspeccion = await deps.repositorio.obtenerInspeccionPorSiniestro(siniestro.id);
    expect(inspeccion?.verdictFraude).toBe('INCONSISTENCIA_TEMPORAL');
  });

  it('cuota agotada de la IA → degradación AMARILLA con IA_NO_DISPONIBLE', async () => {
    const deps = depsDePrueba('cuota-agotada');
    const siniestroId = await crearSiniestroConImagen(deps.repositorio, deps.almacen);

    // No lanza: degrada el análisis
    const resultado = await analyzeClaim(deps, siniestroId, USUARIO);

    expect(resultado.ruta).toBe('AMARILLA');
    expect(resultado.etiquetas).toContain('IA_NO_DISPONIBLE');
    expect(resultado.etiquetas).toContain('SIN_PIEZAS_VALIDAS');

    const siniestro = await deps.repositorio.obtenerSiniestroPorId(siniestroId);
    expect(siniestro?.analisisEstado).toBe('COMPLETADO');
    expect(siniestro?.estado).toBe('EN_REVISION');

    const inspeccion = await deps.repositorio.obtenerInspeccionPorSiniestro(siniestroId);
    expect(inspeccion?.modeloIa).toBeNull();
    expect(inspeccion?.respuestaIa).toBeNull();

    expect(deps.auditoria.todos().some((r) => r.accion === 'ANALISIS_IA_DEGRADADO')).toBe(true);
  });

  it('limite RPM agotado → degradación AMARILLA con IA_NO_DISPONIBLE', async () => {
    const deps = depsDePrueba('leve-faro', {
      limitadorRpm: new TokenBucketRateLimiter(0, 10),
    });
    const siniestroId = await crearSiniestroConImagen(deps.repositorio, deps.almacen);

    const resultado = await analyzeClaim(deps, siniestroId, USUARIO);

    expect(resultado.ruta).toBe('AMARILLA');
    expect(resultado.etiquetas).toContain('IA_NO_DISPONIBLE');
  });

  it('cuota diaria agotada (200 inspecciones hoy) → degradación', async () => {
    const repositorio = new InMemoryClaimRepository();
    repositorio.ahora = AHORA;
    // Sembrar 200 inspecciones DIGITAL_IA de hoy
    for (let i = 0; i < 200; i += 1) {
      await repositorio.crearInspeccion({
        siniestroId: crypto.randomUUID(),
        tipoInspeccion: 'DIGITAL_IA',
        verdictFraude: 'SIN_RIESGO',
        indicadoresFraude: [],
        nivelSeveridad: null,
        costoTotalEstimado: null,
        confianzaGlobal: null,
        modeloIa: null,
        versionPrompt: null,
        respuestaIa: null,
      });
    }
    const deps = depsDePrueba('leve-faro', { repositorio });
    const siniestroId = await crearSiniestroConImagen(repositorio, deps.almacen);

    const resultado = await analyzeClaim(deps, siniestroId, USUARIO);

    expect(resultado.ruta).toBe('AMARILLA');
    expect(resultado.etiquetas).toContain('IA_NO_DISPONIBLE');
  });

  it('fallo inesperado → analisis_estado FALLIDO, auditoría y relanza', async () => {
    const proveedorFallido: AiProvider = {
      versionPrompt: 'v1',
      analizarDanos: () => {
        throw new Error('boom inesperado');
      },
    };
    const deps = depsDePrueba('leve-faro', { proveedorIa: proveedorFallido });
    const siniestroId = await crearSiniestroConImagen(deps.repositorio, deps.almacen);

    await expect(analyzeClaim(deps, siniestroId, USUARIO)).rejects.toThrow('boom inesperado');

    const siniestro = await deps.repositorio.obtenerSiniestroPorId(siniestroId);
    expect(siniestro?.analisisEstado).toBe('FALLIDO');
    expect(
      deps.auditoria
        .todos()
        .some((r) => r.accion === 'ANALISIS_FALLIDO' && r.actorTipo === 'SISTEMA'),
    ).toBe(true);
  });

  it('rechaza siniestro ajeno', async () => {
    const deps = depsDePrueba('leve-faro');
    const siniestroId = await crearSiniestroConImagen(deps.repositorio, deps.almacen);

    await expect(analyzeClaim(deps, siniestroId, OTRO_USUARIO)).rejects.toMatchObject({
      code: 'SINIESTRO_AJENO',
      status: 403,
    });
  });

  it('rechaza siniestro inexistente', async () => {
    const deps = depsDePrueba();
    await expect(analyzeClaim(deps, 'no-existe', USUARIO)).rejects.toMatchObject({
      code: 'SINIESTRO_NO_ENCONTRADO',
      status: 404,
    });
  });

  it('rechaza siniestro sin imágenes', async () => {
    const deps = depsDePrueba();
    const siniestro = await deps.repositorio.crearSiniestro({
      aseguradoId: USUARIO,
      vehiculoId: VEHICULO,
      descripcion: null,
      latitud: LATITUD,
      longitud: LONGITUD,
      fechaIncidente: '2026-01-15T11:50:00Z',
      fechaRegistro: '2026-01-15T11:56:00Z',
    });

    await expect(analyzeClaim(deps, siniestro.id, USUARIO)).rejects.toMatchObject({
      code: 'SIN_IMAGENES',
      status: 409,
    });
  });

  it('rechaza reanalizar un siniestro ya completado', async () => {
    const deps = depsDePrueba('leve-faro');
    const siniestroId = await crearSiniestroConImagen(deps.repositorio, deps.almacen);
    await analyzeClaim(deps, siniestroId, USUARIO);

    await expect(analyzeClaim(deps, siniestroId, USUARIO)).rejects.toMatchObject({
      code: 'ANALISIS_YA_COMPLETADO',
      status: 409,
    });
  });

  it('etiqueta CODIGOS_DESCONOCIDOS cuando la IA inventa un código', async () => {
    // 'sin-piezas' devuelve 0 piezas; usamos baremo vacío con 'leve-faro'
    // para que FARO_DEL_IZQ quede fuera del baremo.
    const deps = depsDePrueba('leve-faro', { baremo: new InMemoryBaremoRepository() });
    const siniestroId = await crearSiniestroConImagen(deps.repositorio, deps.almacen);

    const resultado = await analyzeClaim(deps, siniestroId, USUARIO);

    expect(resultado.piezasValidas).toBe(0);
    expect(resultado.etiquetas).toContain('CODIGOS_DESCONOCIDOS');
    expect(resultado.etiquetas).toContain('SIN_PIEZAS_VALIDAS');
    expect(resultado.ruta).toBe('AMARILLA');
  });
});
