import { describe, it, expect } from 'vitest';
import { issueVerdict } from './issue-verdict';
import { InMemoryClaimRepository } from '@/infrastructure/repositories/in-memory-claim-repository';
import { InMemoryBaremoRepository } from '@/infrastructure/repositories/in-memory-baremo-repository';
import { InMemoryAuditRepository } from '@/infrastructure/repositories/in-memory-audit-repository';

const PERITO = '11111111-1111-1111-1111-111111111111';
const ASEGURADO = '00000000-0000-0000-0000-000000000001';

async function sembrar(conAjustesPrevios = true) {
  const repositorio = new InMemoryClaimRepository();
  repositorio.ahora = new Date('2026-10-05T10:00:00Z');
  const baremo = new InMemoryBaremoRepository();
  baremo.definir('FARO_DEL_IZQ', {
    costo_repuesto_base: 120,
    horas_mano_obra: 1.0,
    costo_hora_mo: 30,
  });
  baremo.definir('PUERTA_DEL_IZQ', {
    costo_repuesto_base: 300,
    horas_mano_obra: 3.5,
    costo_hora_mo: 30,
  });
  const auditoria = new InMemoryAuditRepository();

  const vehiculo = await repositorio.crearVehiculo({
    aseguradoId: ASEGURADO,
    matricula: 'ABC-123',
    marca: 'Toyota',
    modelo: 'Yaris',
    numeroPoliza: 'POL-1',
  });
  const siniestro = await repositorio.crearSiniestro({
    aseguradoId: ASEGURADO,
    vehiculoId: vehiculo.id,
    descripcion: 'Choque',
    latitud: 19.4326,
    longitud: -99.1332,
    fechaIncidente: '2026-10-04T08:00:00Z',
    fechaRegistro: '2026-10-05T09:00:00Z',
  });
  await repositorio.actualizarSiniestro(siniestro.id, {
    estado: 'EN_REVISION',
    ruta: 'AMARILLA',
  });
  const inspeccion = await repositorio.crearInspeccion({
    siniestroId: siniestro.id,
    tipoInspeccion: 'DIGITAL_IA',
    verdictFraude: 'SIN_RIESGO',
    indicadoresFraude: [],
    nivelSeveridad: 'MODERADO',
    costoTotalEstimado: 150,
    confianzaGlobal: 0.8,
    modeloIa: 'gemini-test',
    versionPrompt: 'v1',
    respuestaIa: {},
  });
  if (conAjustesPrevios) {
    await repositorio.crearEvaluaciones([
      {
        inspeccionId: inspeccion.id,
        codigoPieza: 'FARO_DEL_IZQ',
        accionRequerida: 'SUSTITUIR',
        horasManoObra: 1.0,
        costoPiezaEstimado: 150,
        confianza: 0.9,
        imagenId: null,
        bbox: [10, 10, 200, 200],
      },
      {
        inspeccionId: inspeccion.id,
        codigoPieza: 'PUERTA_DEL_IZQ',
        accionRequerida: 'REPARAR',
        horasManoObra: 3.5,
        costoPiezaEstimado: 105,
        confianza: 0.8,
        imagenId: null,
        bbox: [0, 0, 500, 500],
      },
    ]);
  }
  return {
    repositorio,
    baremo,
    auditoria,
    siniestro,
    inspeccion,
  };
}

function evaluacionesDelSiniestro(repositorio: InMemoryClaimRepository, inspeccionId: string) {
  return repositorio.listarEvaluacionesPorInspeccion(inspeccionId);
}

describe('issueVerdict', () => {
  it('debería impedir dictaminar durante el reanálisis sin modificar piezas ni auditoría', async () => {
    const ctx = await sembrar();
    await ctx.repositorio.actualizarSiniestro(ctx.siniestro.id, { analisisEstado: 'EN_PROCESO' });
    const anteriores = await evaluacionesDelSiniestro(ctx.repositorio, ctx.inspeccion.id);
    await expect(
      issueVerdict(ctx, {
        siniestroId: ctx.siniestro.id,
        peritoId: PERITO,
        dictamenFinal: 'APROBADO',
        observacionesPerito: null,
      }),
    ).rejects.toMatchObject({ code: 'ESTADO_INVALIDO', status: 409 });
    expect(await evaluacionesDelSiniestro(ctx.repositorio, ctx.inspeccion.id)).toEqual(anteriores);
    expect(ctx.auditoria.todos()).toHaveLength(0);
  });

  it('debería excluir del presupuesto las piezas no aprobadas por el perito', async () => {
    const ctx = await sembrar();
    const piezas = await evaluacionesDelSiniestro(ctx.repositorio, ctx.inspeccion.id);
    await issueVerdict(ctx, {
      siniestroId: ctx.siniestro.id,
      peritoId: PERITO,
      dictamenFinal: 'APROBADO',
      observacionesPerito: null,
      ajustes: piezas.map((p) => ({
        evaluacionId: p.id,
        aprobadoPorPerito: p.codigoPieza === 'FARO_DEL_IZQ',
      })),
    });
    expect(
      (await ctx.repositorio.obtenerInspeccionPorSiniestro(ctx.siniestro.id))?.costoTotalEstimado,
    ).toBe(150);
  });
  it('debería validar todos los ajustes antes de guardar cambios', async () => {
    const ctx = await sembrar();
    const [pieza] = await evaluacionesDelSiniestro(ctx.repositorio, ctx.inspeccion.id);
    await expect(
      issueVerdict(ctx, {
        siniestroId: ctx.siniestro.id,
        peritoId: PERITO,
        dictamenFinal: 'APROBADO',
        observacionesPerito: null,
        ajustes: [
          { evaluacionId: pieza.id, costoPiezaEstimado: 1, aprobadoPorPerito: true },
          { evaluacionId: 'ajena', aprobadoPorPerito: true },
        ],
      }),
    ).rejects.toMatchObject({ code: 'EVALUACION_AJENA' });
    expect((await evaluacionesDelSiniestro(ctx.repositorio, ctx.inspeccion.id))[0]).toEqual(pieza);
    expect(ctx.auditoria.todos()).toHaveLength(0);
  });

  it('debería rechazar ajustes duplicados sin guardar cambios', async () => {
    const ctx = await sembrar();
    const [pieza] = await evaluacionesDelSiniestro(ctx.repositorio, ctx.inspeccion.id);
    await expect(
      issueVerdict(ctx, {
        siniestroId: ctx.siniestro.id,
        peritoId: PERITO,
        dictamenFinal: 'APROBADO',
        observacionesPerito: null,
        ajustes: [
          { evaluacionId: pieza.id, aprobadoPorPerito: true },
          { evaluacionId: pieza.id, aprobadoPorPerito: false },
        ],
      }),
    ).rejects.toMatchObject({ code: 'AJUSTE_DUPLICADO' });
  });

  it('debería conservar costos manuales si solo cambia la aprobación', async () => {
    const ctx = await sembrar();
    const [pieza] = await evaluacionesDelSiniestro(ctx.repositorio, ctx.inspeccion.id);
    await ctx.repositorio.actualizarEvaluacion(pieza.id, { costoPiezaEstimado: 88 });
    await issueVerdict(ctx, {
      siniestroId: ctx.siniestro.id,
      peritoId: PERITO,
      dictamenFinal: 'APROBADO',
      observacionesPerito: null,
      ajustes: [{ evaluacionId: pieza.id, aprobadoPorPerito: true }],
    });
    const inspeccion = await ctx.repositorio.obtenerInspeccionPorSiniestro(ctx.siniestro.id);
    expect(inspeccion?.costoTotalEstimado).toBe(193);
  });

  it('debería auditar el costo conservado cuando no hay ajustes', async () => {
    const ctx = await sembrar();
    await issueVerdict(ctx, {
      siniestroId: ctx.siniestro.id,
      peritoId: PERITO,
      dictamenFinal: 'APROBADO',
      observacionesPerito: null,
    });
    expect(ctx.auditoria.todos()[0].datos).toMatchObject({ costoAnterior: 150, costoNuevo: 150 });
  });
  it('debería aprobar un siniestro EN_REVISION y pasarlo a APROBADO', async () => {
    const ctx = await sembrar();
    const estado = await issueVerdict(
      {
        repositorio: ctx.repositorio,
        baremo: ctx.baremo,
        auditoria: ctx.auditoria,
      },
      {
        siniestroId: ctx.siniestro.id,
        peritoId: PERITO,
        dictamenFinal: 'APROBADO',
        observacionesPerito: 'Todo correcto',
      },
    );
    expect(estado).toBe('APROBADO');
    const actualizado = await ctx.repositorio.obtenerSiniestroPorId(ctx.siniestro.id);
    expect(actualizado?.estado).toBe('APROBADO');
    const inspeccion = await ctx.repositorio.obtenerInspeccionPorSiniestro(ctx.siniestro.id);
    expect(inspeccion?.dictamenFinal).toBe('APROBADO');
    expect(inspeccion?.peritoId).toBe(PERITO);
    expect(inspeccion?.observacionesPerito).toBe('Todo correcto');
  });

  it('debería aplicar ajustes y recalcular el costo total', async () => {
    const ctx = await sembrar();
    const evaluaciones = await evaluacionesDelSiniestro(ctx.repositorio, ctx.inspeccion.id);
    const faro = evaluaciones.find((e) => e.codigoPieza === 'FARO_DEL_IZQ')!;
    // Cambiar la puerta a SUSTITUIR: 300 + 3.5*30 = 405 en lugar de 105.
    await issueVerdict(
      {
        repositorio: ctx.repositorio,
        baremo: ctx.baremo,
        auditoria: ctx.auditoria,
      },
      {
        siniestroId: ctx.siniestro.id,
        peritoId: PERITO,
        dictamenFinal: 'APROBADO',
        observacionesPerito: null,
        ajustes: [
          {
            evaluacionId: faro.id,
            aprobadoPorPerito: true,
          },
          {
            evaluacionId: evaluaciones.find((e) => e.codigoPieza === 'PUERTA_DEL_IZQ')!.id,
            accionRequerida: 'SUSTITUIR',
            aprobadoPorPerito: true,
          },
        ],
      },
    );
    const inspeccion = await ctx.repositorio.obtenerInspeccionPorSiniestro(ctx.siniestro.id);
    // Faro SUSTITUIR 150 + Puerta SUSTITUIR 405 = 555.
    expect(inspeccion?.costoTotalEstimado).toBe(555);
  });

  it('debería usar el costo explícito del ajuste cuando se proporciona', async () => {
    const ctx = await sembrar();
    const evaluaciones = await evaluacionesDelSiniestro(ctx.repositorio, ctx.inspeccion.id);
    const faro = evaluaciones.find((e) => e.codigoPieza === 'FARO_DEL_IZQ')!;
    await issueVerdict(
      {
        repositorio: ctx.repositorio,
        baremo: ctx.baremo,
        auditoria: ctx.auditoria,
      },
      {
        siniestroId: ctx.siniestro.id,
        peritoId: PERITO,
        dictamenFinal: 'APROBADO',
        observacionesPerito: null,
        ajustes: [
          {
            evaluacionId: faro.id,
            costoPiezaEstimado: 99.99,
            aprobadoPorPerito: true,
          },
          {
            evaluacionId: evaluaciones.find((e) => e.codigoPieza === 'PUERTA_DEL_IZQ')!.id,
            aprobadoPorPerito: true,
          },
        ],
      },
    );
    const inspeccion = await ctx.repositorio.obtenerInspeccionPorSiniestro(ctx.siniestro.id);
    // 99.99 + 105 (puerta sin cambio) = 204.99.
    expect(inspeccion?.costoTotalEstimado).toBe(204.99);
  });

  it('debería rechazar solo con observaciones y pasar a RECHAZADO', async () => {
    const ctx = await sembrar();
    const estado = await issueVerdict(
      {
        repositorio: ctx.repositorio,
        baremo: ctx.baremo,
        auditoria: ctx.auditoria,
      },
      {
        siniestroId: ctx.siniestro.id,
        peritoId: PERITO,
        dictamenFinal: 'RECHAZADO',
        observacionesPerito: 'No hay daños visibles en las fotos',
      },
    );
    expect(estado).toBe('RECHAZADO');
    const actualizado = await ctx.repositorio.obtenerSiniestroPorId(ctx.siniestro.id);
    expect(actualizado?.estado).toBe('RECHAZADO');
  });

  it('debería solicitar ampliación y permanecer en EN_REVISION', async () => {
    const ctx = await sembrar();
    const estado = await issueVerdict(
      {
        repositorio: ctx.repositorio,
        baremo: ctx.baremo,
        auditoria: ctx.auditoria,
      },
      {
        siniestroId: ctx.siniestro.id,
        peritoId: PERITO,
        dictamenFinal: 'AMPLIACION_REQUERIDA',
        observacionesPerito: 'Faltan fotos del guardabarros',
      },
    );
    expect(estado).toBe('EN_REVISION');
    const actualizado = await ctx.repositorio.obtenerSiniestroPorId(ctx.siniestro.id);
    expect(actualizado?.estado).toBe('EN_REVISION');
    const inspeccion = await ctx.repositorio.obtenerInspeccionPorSiniestro(ctx.siniestro.id);
    expect(inspeccion?.dictamenFinal).toBe('AMPLIACION_REQUERIDA');
  });

  it('debería guardar el kilometraje', async () => {
    const ctx = await sembrar();
    await issueVerdict(
      {
        repositorio: ctx.repositorio,
        baremo: ctx.baremo,
        auditoria: ctx.auditoria,
      },
      {
        siniestroId: ctx.siniestro.id,
        peritoId: PERITO,
        dictamenFinal: 'APROBADO',
        observacionesPerito: null,
        kilometraje: 45230,
      },
    );
    const inspeccion = await ctx.repositorio.obtenerInspeccionPorSiniestro(ctx.siniestro.id);
    expect(inspeccion?.kilometraje).toBe(45230);
  });

  it('debería fallar 404 si el siniestro no existe', async () => {
    const ctx = await sembrar();
    await expect(
      issueVerdict(
        {
          repositorio: ctx.repositorio,
          baremo: ctx.baremo,
          auditoria: ctx.auditoria,
        },
        {
          siniestroId: 'no-existe',
          peritoId: PERITO,
          dictamenFinal: 'APROBADO',
          observacionesPerito: null,
        },
      ),
    ).rejects.toMatchObject({ code: 'SINIESTRO_NO_ENCONTRADO', status: 404 });
  });

  it('debería fallar 409 si el siniestro no está en EN_REVISION', async () => {
    const ctx = await sembrar();
    await ctx.repositorio.actualizarSiniestro(ctx.siniestro.id, {
      estado: 'PENDIENTE',
    });
    await expect(
      issueVerdict(
        {
          repositorio: ctx.repositorio,
          baremo: ctx.baremo,
          auditoria: ctx.auditoria,
        },
        {
          siniestroId: ctx.siniestro.id,
          peritoId: PERITO,
          dictamenFinal: 'APROBADO',
          observacionesPerito: null,
        },
      ),
    ).rejects.toMatchObject({ code: 'ESTADO_INVALIDO', status: 409 });
  });

  it('debería fallar 403 si el ajuste pertenece a otra inspección', async () => {
    const ctx = await sembrar();
    // Crear un segundo siniestro con su propia inspección.
    const vehiculo = await ctx.repositorio.crearVehiculo({
      aseguradoId: ASEGURADO,
      matricula: 'DEF-456',
      marca: 'Kia',
      modelo: 'Rio',
      numeroPoliza: 'POL-9',
    });
    const otro = await ctx.repositorio.crearSiniestro({
      aseguradoId: ASEGURADO,
      vehiculoId: vehiculo.id,
      descripcion: 'Otro',
      latitud: 19.4326,
      longitud: -99.1332,
      fechaIncidente: '2026-10-04T08:00:00Z',
      fechaRegistro: '2026-10-05T09:05:00Z',
    });
    await ctx.repositorio.actualizarSiniestro(otro.id, {
      estado: 'EN_REVISION',
      ruta: 'AMARILLA',
    });
    const otraInspeccion = await ctx.repositorio.crearInspeccion({
      siniestroId: otro.id,
      tipoInspeccion: 'DIGITAL_IA',
      verdictFraude: 'SIN_RIESGO',
      indicadoresFraude: [],
      nivelSeveridad: 'LEVE',
      costoTotalEstimado: 10,
      confianzaGlobal: 0.9,
      modeloIa: 'gemini-test',
      versionPrompt: 'v1',
      respuestaIa: {},
    });
    await ctx.repositorio.crearEvaluaciones([
      {
        inspeccionId: otraInspeccion.id,
        codigoPieza: 'FARO_DEL_IZQ',
        accionRequerida: 'REPARAR',
        horasManoObra: 1,
        costoPiezaEstimado: 30,
        confianza: 0.9,
        imagenId: null,
        bbox: null,
      },
    ]);
    const evaluacionAjena = (
      await ctx.repositorio.listarEvaluacionesPorInspeccion(otraInspeccion.id)
    )[0];

    await expect(
      issueVerdict(
        {
          repositorio: ctx.repositorio,
          baremo: ctx.baremo,
          auditoria: ctx.auditoria,
        },
        {
          siniestroId: ctx.siniestro.id,
          peritoId: PERITO,
          dictamenFinal: 'APROBADO',
          observacionesPerito: null,
          ajustes: [{ evaluacionId: evaluacionAjena.id, aprobadoPorPerito: true }],
        },
      ),
    ).rejects.toMatchObject({ code: 'EVALUACION_AJENA', status: 403 });
  });

  it('debería escribir auditoría con actor USUARIO y valores anterior/nuevo', async () => {
    const ctx = await sembrar();
    await issueVerdict(
      {
        repositorio: ctx.repositorio,
        baremo: ctx.baremo,
        auditoria: ctx.auditoria,
      },
      {
        siniestroId: ctx.siniestro.id,
        peritoId: PERITO,
        dictamenFinal: 'APROBADO',
        observacionesPerito: 'OK',
      },
    );
    const registros = await ctx.auditoria.listarPorEntidad('siniestros', ctx.siniestro.id);
    const delDictamen = registros.find((r) => r.accion === 'DICTAMEN_REGISTRADO');
    expect(delDictamen).toBeDefined();
    expect(delDictamen?.actorTipo).toBe('USUARIO');
    expect(delDictamen?.actorId).toBe(PERITO);
    expect((delDictamen?.datos as Record<string, unknown>).estadoAnterior).toBe('EN_REVISION');
    expect((delDictamen?.datos as Record<string, unknown>).estadoNuevo).toBe('APROBADO');
  });

  it('debería aprobar piezas en las evaluaciones', async () => {
    const ctx = await sembrar();
    const evaluaciones = await evaluacionesDelSiniestro(ctx.repositorio, ctx.inspeccion.id);
    const faro = evaluaciones.find((e) => e.codigoPieza === 'FARO_DEL_IZQ')!;
    const puerta = evaluaciones.find((e) => e.codigoPieza === 'PUERTA_DEL_IZQ')!;
    await issueVerdict(
      {
        repositorio: ctx.repositorio,
        baremo: ctx.baremo,
        auditoria: ctx.auditoria,
      },
      {
        siniestroId: ctx.siniestro.id,
        peritoId: PERITO,
        dictamenFinal: 'APROBADO',
        observacionesPerito: null,
        ajustes: [
          {
            evaluacionId: faro.id,
            aprobadoPorPerito: true,
            observacionPieza: 'Faro confirmado',
          },
          {
            evaluacionId: puerta.id,
            aprobadoPorPerito: false,
            observacionPieza: 'No se aprecia daño',
          },
        ],
      },
    );
    const actualizadas = await evaluacionesDelSiniestro(ctx.repositorio, ctx.inspeccion.id);
    const faroActual = actualizadas.find((e) => e.id === faro.id)!;
    const puertaActual = actualizadas.find((e) => e.id === puerta.id)!;
    expect(faroActual.aprobadoPorPerito).toBe(true);
    expect(faroActual.observacionPieza).toBe('Faro confirmado');
    expect(puertaActual.aprobadoPorPerito).toBe(false);
    expect(puertaActual.observacionPieza).toBe('No se aprecia daño');
  });
});
