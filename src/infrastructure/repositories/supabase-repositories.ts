import { workflowRpc } from '@/infrastructure/supabase/workflow-rpc';
import { getAdminClient } from '@/infrastructure/supabase/admin-client';
import { AppError } from '@/lib/errors';
import { workflowError } from '@/infrastructure/supabase/workflow-error';
import { tabla } from '@/infrastructure/supabase/tabla';
import type { ClaimRepository } from '@/application/ports/claim-repository';
import type {
  CambiosSiniestro,
  CambiosEvaluacion,
  CambiosInspeccionDictamen,
  CambiosVehiculo,
  CrearEvaluacionInput,
  CrearImagenInput,
  CrearInspeccionInput,
  CrearSiniestroInput,
  CrearVehiculoInput,
  FiltrosSiniestros,
  ListaSiniestros,
} from '@/application/ports/claim-repository';
import type {
  EvaluacionDanos,
  ImagenSiniestro,
  InspeccionPericial,
  Siniestro,
  Vehiculo,
} from '@/domain/entities';
import type { AuditRepository } from '@/application/ports/audit-repository';
import type {
  RegistroAuditoria,
  RegistrarAuditoriaInput,
} from '@/application/ports/audit-repository';
import type { BaremoRepository } from '@/application/ports/baremo-repository';
import type { EntradaBaremo } from '@/domain/cost/cost';
import type { Ruta, TipoInspeccion, VerdictFraude, Etiqueta } from '@/domain/types';

/** Mapeo fila (snake_case) → entidad (camelCase). */
function aSiniestro(fila: Record<string, unknown>): Siniestro {
  return {
    id: fila.id as string,
    aseguradoId: fila.asegurado_id as string,
    vehiculoId: fila.vehiculo_id as string,
    fechaRegistro: fila.fecha_registro as string,
    fechaIncidente: fila.fecha_incidente as string,
    latitud: fila.latitud as number,
    longitud: fila.longitud as number,
    descripcion: (fila.descripcion as string | null) ?? null,
    estado: fila.estado as Siniestro['estado'],
    ruta: (fila.ruta as Ruta | null) ?? null,
    analisisEstado: fila.analisis_estado as Siniestro['analisisEstado'],
    analisisToken: (fila.analisis_token as string | null) ?? null,
    analisisIniciadoEn: (fila.analisis_iniciado_en as string | null) ?? null,
    requiereInspeccionPresencial: fila.requiere_inspeccion_presencial as boolean,
    etiquetas: ((fila.etiquetas as string[] | null) ?? []) as Etiqueta[],
  };
}

function aVehiculo(fila: Record<string, unknown>): Vehiculo {
  return {
    id: fila.id as string,
    aseguradoId: fila.asegurado_id as string,
    matricula: fila.matricula as string,
    marca: fila.marca as string,
    modelo: fila.modelo as string,
    numeroPoliza: fila.numero_poliza as string,
  };
}

function aImagen(fila: Record<string, unknown>): ImagenSiniestro {
  return {
    recibidaEn: fila.creado_en as string | undefined,
    id: fila.id as string,
    siniestroId: fila.siniestro_id as string,
    storagePath: fila.storage_path as string,
    hashPerceptual: fila.hash_perceptual as string,
    capturadaEn: fila.capturada_en as string,
    latitud: (fila.latitud as number | null) ?? null,
    longitud: (fila.longitud as number | null) ?? null,
    precisionGpsM: (fila.precision_gps_m as number | null) ?? null,
    userAgent: (fila.user_agent as string | null) ?? null,
    orden: fila.orden as number,
    rostrosDifuminados: fila.rostros_difuminados as boolean,
  };
}

function aInspeccion(fila: Record<string, unknown>): InspeccionPericial {
  return {
    id: fila.id as string,
    siniestroId: fila.siniestro_id as string,
    peritoId: (fila.perito_id as string | null) ?? null,
    fechaInspeccion: fila.fecha_inspeccion as string,
    tipoInspeccion: fila.tipo_inspeccion as TipoInspeccion,
    kilometraje: (fila.kilometraje as number | null) ?? null,
    observacionesPerito: (fila.observaciones_perito as string | null) ?? null,
    dictamenFinal: (fila.dictamen_final as InspeccionPericial['dictamenFinal']) ?? null,
    verdictFraude: fila.verdict_fraude as VerdictFraude,
    indicadoresFraude: (fila.indicadores_fraude as VerdictFraude[] | null) ?? [],
    nivelSeveridad: (fila.nivel_severidad as InspeccionPericial['nivelSeveridad']) ?? null,
    costoTotalEstimado: (fila.costo_total_estimado as number | null) ?? null,
    confianzaGlobal: (fila.confianza_global as number | null) ?? null,
    modeloIa: (fila.modelo_ia as string | null) ?? null,
    versionPrompt: (fila.version_prompt as string | null) ?? null,
    respuestaIa: fila.respuesta_ia ?? null,
  };
}

function aEvaluacion(fila: Record<string, unknown>): EvaluacionDanos {
  return {
    id: fila.id as string,
    inspeccionId: fila.inspeccion_id as string,
    codigoPieza: fila.codigo_pieza as string,
    accionRequerida: fila.accion_requerida as EvaluacionDanos['accionRequerida'],
    horasManoObra: fila.horas_mano_obra as number,
    costoPiezaEstimado: fila.costo_pieza_estimado as number,
    confianza: (fila.confianza as number | null) ?? null,
    imagenId: (fila.imagen_id as string | null) ?? null,
    bbox: fila.bbox as EvaluacionDanos['bbox'],
    aprobadoPorPerito: fila.aprobado_por_perito as boolean,
    observacionPieza: (fila.observacion_pieza as string | null) ?? null,
  };
}

/**
 * Implementación Supabase del repositorio de siniestros.
 * Usa el cliente admin (service role): las escrituras del
 * sistema (IA, auditoría, órdenes) no pasan por RLS.
 */
export class SupabaseClaimRepository implements ClaimRepository {
  async fallarAnalisis(id: string, token: string | null): Promise<boolean> {
    const { data, error } = await workflowRpc('fallar_analisis_reservado', {
      p_siniestro: id,
      p_token: token,
    });
    if (error) workflowError(error);
    return data === true;
  }
  async recuperarAnalisis(id: string, usuarioId: string): Promise<void> {
    const { error } = await workflowRpc('recuperar_analisis_detenido', {
      p_siniestro: id,
      p_usuario: usuarioId,
    });
    if (error) workflowError(error);
  }
  async guardarAnalisisAtomico(
    input: Parameters<NonNullable<ClaimRepository['guardarAnalisisAtomico']>>[0],
  ): Promise<void> {
    const { error } = await workflowRpc('guardar_analisis_atomico', { p_datos: input });
    if (error) workflowError(error);
  }
  async registrarImagenAtomica(
    input: CrearImagenInput,
    ampliacionId?: string,
  ): Promise<ImagenSiniestro> {
    const { data, error } = await workflowRpc('registrar_imagen_atomica', {
      p_foto: input,
      p_ampliacion: ampliacionId ?? null,
    });
    if (error) workflowError(error);
    return aImagen(data as Record<string, unknown>);
  }
  async entregarAmpliacionAtomica(
    siniestroId: string,
    usuarioId: string,
    ampliacionId: string,
  ): Promise<void> {
    const { error } = await workflowRpc('entregar_ampliacion_atomica', {
      p_siniestro: siniestroId,
      p_usuario: usuarioId,
      p_ampliacion: ampliacionId,
    });
    if (error) workflowError(error);
  }
  async registrarDictamenAtomico(
    input: Parameters<NonNullable<ClaimRepository['registrarDictamenAtomico']>>[0],
  ): Promise<void> {
    const { error } = await workflowRpc('registrar_dictamen_atomico', {
      p_siniestro: input.siniestroId,
      p_inspeccion: input.inspeccionId,
      p_cambios: input.cambios,
      p_ajustes: input.ajustes,
    });
    if (error) workflowError(error);
  }
  async crearVehiculo(input: CrearVehiculoInput): Promise<Vehiculo> {
    const { data, error } = await tabla(getAdminClient(), 'vehiculos')
      .insert({
        asegurado_id: input.aseguradoId,
        matricula: input.matricula,
        marca: input.marca,
        modelo: input.modelo,
        numero_poliza: input.numeroPoliza,
      })
      .select()
      .single();
    if (error || !data) {
      throw new Error(`No se pudo crear el vehículo: ${error?.message ?? 'sin datos'}`);
    }
    return aVehiculo(data as unknown as Record<string, unknown>);
  }

  async obtenerVehiculoPorId(id: string): Promise<Vehiculo | null> {
    const { data, error } = await tabla(getAdminClient(), 'vehiculos')
      .select()
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return aVehiculo(data as unknown as Record<string, unknown>);
  }

  async listarVehiculosPorAsegurado(aseguradoId: string): Promise<Vehiculo[]> {
    const { data, error } = await tabla(getAdminClient(), 'vehiculos')
      .select()
      .eq('asegurado_id', aseguradoId)
      .order('matricula', { ascending: true });
    if (error) {
      console.error('Error cargando vehículos:', error);
      throw new Error(error.message);
    }
    if (!data) return [];
    return (data as unknown as Record<string, unknown>[]).map(aVehiculo);
  }

  async actualizarVehiculo(id: string, cambios: CambiosVehiculo): Promise<Vehiculo> {
    const fila: Record<string, unknown> = { id };
    if (cambios.matricula !== undefined) fila.matricula = cambios.matricula;
    if (cambios.marca !== undefined) fila.marca = cambios.marca;
    if (cambios.modelo !== undefined) fila.modelo = cambios.modelo;
    if (cambios.numeroPoliza !== undefined) fila.numero_poliza = cambios.numeroPoliza;

    const { data, error } = await tabla(getAdminClient(), 'vehiculos')
      .update(fila)
      .eq('id', id)
      .select()
      .single();
    if (error || !data) {
      throw new Error(`No se pudo actualizar el vehículo: ${error?.message ?? 'sin datos'}`);
    }
    return aVehiculo(data as unknown as Record<string, unknown>);
  }

  async eliminarVehiculo(id: string): Promise<void> {
    const { error } = await tabla(getAdminClient(), 'vehiculos').delete().eq('id', id);
    if (error) {
      throw new Error(`No se pudo eliminar el vehículo: ${error.message}`);
    }
  }

  async obtenerVehiculoPorMatricula(matricula: string): Promise<Vehiculo | null> {
    const { data, error } = await tabla(getAdminClient(), 'vehiculos')
      .select()
      .eq('matricula', matricula)
      .maybeSingle();
    if (error || !data) return null;
    return aVehiculo(data as unknown as Record<string, unknown>);
  }

  async obtenerVehiculoPorNumeroPoliza(numeroPoliza: string): Promise<Vehiculo | null> {
    const { data, error } = await tabla(getAdminClient(), 'vehiculos')
      .select()
      .eq('numero_poliza', numeroPoliza)
      .maybeSingle();
    if (error || !data) return null;
    return aVehiculo(data as unknown as Record<string, unknown>);
  }

  async contarSiniestrosPorVehiculo(vehiculoId: string): Promise<number> {
    const { count, error } = await tabla(getAdminClient(), 'siniestros')
      .select('id', { count: 'exact', head: true })
      .eq('vehiculo_id', vehiculoId);
    if (error || count === null) return 0;
    return count;
  }

  async crearSiniestro(input: CrearSiniestroInput): Promise<Siniestro> {
    const { data, error } = await tabla(getAdminClient(), 'siniestros')
      .insert({
        ...(input.id ? { id: input.id } : {}),
        asegurado_id: input.aseguradoId,
        vehiculo_id: input.vehiculoId,
        descripcion: input.descripcion,
        latitud: input.latitud,
        longitud: input.longitud,
        fecha_incidente: input.fechaIncidente,
        fecha_registro: input.fechaRegistro,
      })
      .select()
      .single();
    if (error || !data) {
      throw new Error(`No se pudo crear el siniestro: ${error?.message ?? 'sin datos'}`);
    }
    return aSiniestro(data as unknown as Record<string, unknown>);
  }

  async obtenerSiniestroPorId(id: string): Promise<Siniestro | null> {
    const { data, error } = await tabla(getAdminClient(), 'siniestros')
      .select()
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return aSiniestro(data as unknown as Record<string, unknown>);
  }

  async listarSiniestrosPorAsegurado(aseguradoId: string): Promise<Siniestro[]> {
    const { data, error } = await tabla(getAdminClient(), 'siniestros')
      .select()
      .eq('asegurado_id', aseguradoId)
      .order('fecha_registro', { ascending: false });
    if (error || !data) return [];
    return (data as unknown as Record<string, unknown>[]).map(aSiniestro);
  }

  async listarTodosLosSiniestros(): Promise<Siniestro[]> {
    const { data, error } = await tabla(getAdminClient(), 'siniestros')
      .select()
      .order('fecha_registro', { ascending: false });
    if (error || !data) return [];
    return (data as unknown as Record<string, unknown>[]).map(aSiniestro);
  }

  async listarSiniestros(
    aseguradoId: string | null,
    filtros: FiltrosSiniestros,
  ): Promise<ListaSiniestros> {
    let consulta = tabla(getAdminClient(), 'siniestros').select(
      'id, asegurado_id, vehiculo_id, fecha_registro, fecha_incidente, latitud, longitud, descripcion, estado, ruta, analisis_estado, requiere_inspeccion_presencial, etiquetas',
      { count: 'exact' },
    );
    if (aseguradoId !== null) {
      consulta = consulta.eq('asegurado_id', aseguradoId);
    }
    if (filtros.ruta) {
      consulta = consulta.eq('ruta', filtros.ruta);
    }
    if (filtros.estado) {
      consulta = consulta.eq('estado', filtros.estado);
    }
    if (filtros.estados) consulta = consulta.in('estado', filtros.estados);
    const desde = (filtros.page - 1) * filtros.pageSize;
    const { data, error, count } = await consulta
      .order('fecha_registro', { ascending: false })
      .range(desde, desde + filtros.pageSize - 1);
    if (error) throw new Error('No se pudo consultar la bandeja de siniestros');
    if (!data) return { items: [], total: 0, page: filtros.page, pageSize: filtros.pageSize };
    return {
      items: (data as unknown as Record<string, unknown>[]).map(aSiniestro),
      total: count ?? 0,
      page: filtros.page,
      pageSize: filtros.pageSize,
    };
  }

  async actualizarSiniestro(id: string, cambios: CambiosSiniestro): Promise<void> {
    const fila: Record<string, unknown> = {};
    if (cambios.estado !== undefined) fila.estado = cambios.estado;
    if (cambios.ruta !== undefined) fila.ruta = cambios.ruta;
    if (cambios.analisisEstado !== undefined) fila.analisis_estado = cambios.analisisEstado;
    if (cambios.requiereInspeccionPresencial !== undefined) {
      fila.requiere_inspeccion_presencial = cambios.requiereInspeccionPresencial;
    }
    if (cambios.etiquetas !== undefined) fila.etiquetas = cambios.etiquetas;
    const { error } = await tabla(getAdminClient(), 'siniestros').update(fila).eq('id', id);
    if (error) {
      throw new Error(`No se pudo actualizar el siniestro: ${error.message}`);
    }
  }

  async contarImagenes(siniestroId: string): Promise<number> {
    const { count, error } = await tabla(getAdminClient(), 'imagenes_siniestro')
      .select('id', { count: 'exact', head: true })
      .eq('siniestro_id', siniestroId);
    if (error) throw new Error('No se pudo comprobar la cantidad de imágenes');
    return count ?? 0;
  }

  async reservarAnalisis(
    id: string,
    analisisEsperado: Siniestro['analisisEstado'],
    estadoEsperado: Siniestro['estado'],
  ): Promise<boolean> {
    if (analisisEsperado === 'EN_PROCESO') return false;
    const { data, error } = await tabla(getAdminClient(), 'siniestros')
      .update({
        analisis_estado: 'EN_PROCESO',
        analisis_token: crypto.randomUUID(),
        analisis_iniciado_en: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('analisis_estado', analisisEsperado)
      .eq('estado', estadoEsperado)
      .select('id');
    if (error?.code === 'PGRST204' || error?.code === '42703')
      workflowError({ code: 'PGRST202', message: 'Falta el esquema de reservas de análisis' });
    if (error) throw new Error('No se pudo reservar el análisis');
    return data?.length === 1;
  }

  async crearImagen(input: CrearImagenInput): Promise<ImagenSiniestro> {
    const { data, error } = await tabla(getAdminClient(), 'imagenes_siniestro')
      .insert({
        id: input.id,
        siniestro_id: input.siniestroId,
        storage_path: input.storagePath,
        hash_perceptual: input.hashPerceptual,
        capturada_en: input.capturadaEn,
        latitud: input.latitud,
        longitud: input.longitud,
        precision_gps_m: input.precisionGpsM,
        user_agent: input.userAgent,
        orden: input.orden,
        rostros_difuminados: input.rostrosDifuminados,
      })
      .select()
      .single();
    if (error || !data) {
      throw new Error(`No se pudo registrar la imagen: ${error?.message ?? 'sin datos'}`);
    }
    return aImagen(data as unknown as Record<string, unknown>);
  }

  async listarImagenes(siniestroId: string): Promise<ImagenSiniestro[]> {
    const { data, error } = await tabla(getAdminClient(), 'imagenes_siniestro')
      .select()
      .eq('siniestro_id', siniestroId)
      .order('orden', { ascending: true });
    if (error) throw new Error('No se pudo consultar las imágenes del caso');
    if (!data) return [];
    return (data as unknown as Record<string, unknown>[]).map(aImagen);
  }

  async listarHashesDeOtrosSiniestros(excluirSiniestroId: string): Promise<string[]> {
    const { data, error } = await tabla(getAdminClient(), 'imagenes_siniestro')
      .select('hash_perceptual')
      .neq('siniestro_id', excluirSiniestroId);
    if (error) throw new Error('No se pudo comprobar la duplicidad de evidencias');
    if (!data) return [];
    return (data as unknown as { hash_perceptual: string }[]).map((f) => f.hash_perceptual);
  }

  async contarInspeccionesDigitalIaHoy(hoy: Date): Promise<number> {
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
    const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    const { count, error } = await tabla(getAdminClient(), 'inspecciones_periciales')
      .select('id', { count: 'exact', head: true })
      .eq('tipo_inspeccion', 'DIGITAL_IA')
      .gte('fecha_inspeccion', inicio.toISOString())
      .lt('fecha_inspeccion', fin.toISOString());
    if (error) throw new Error('No se pudo comprobar la cuota diaria de análisis');
    return count ?? 0;
  }

  async crearInspeccion(input: CrearInspeccionInput): Promise<InspeccionPericial> {
    const { data, error } = await tabla(getAdminClient(), 'inspecciones_periciales')
      .insert({
        siniestro_id: input.siniestroId,
        tipo_inspeccion: input.tipoInspeccion,
        verdict_fraude: input.verdictFraude,
        indicadores_fraude: input.indicadoresFraude,
        nivel_severidad: input.nivelSeveridad,
        costo_total_estimado: input.costoTotalEstimado,
        confianza_global: input.confianzaGlobal,
        modelo_ia: input.modeloIa,
        version_prompt: input.versionPrompt,
        respuesta_ia: input.respuestaIa,
      })
      .select()
      .single();
    if (error || !data) {
      throw new Error(`No se pudo crear la inspección: ${error?.message ?? 'sin datos'}`);
    }
    return aInspeccion(data as unknown as Record<string, unknown>);
  }

  async obtenerInspeccionPorSiniestro(siniestroId: string): Promise<InspeccionPericial | null> {
    const { data, error } = await tabla(getAdminClient(), 'inspecciones_periciales')
      .select()
      .eq('siniestro_id', siniestroId)
      .order('fecha_inspeccion', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return aInspeccion(data as unknown as Record<string, unknown>);
  }

  async actualizarInspeccionDictamen(
    inspeccionId: string,
    cambios: CambiosInspeccionDictamen,
  ): Promise<void> {
    const { data: perito, error: errorPerito } = await tabla(getAdminClient(), 'peritos')
      .select('id, estado')
      .eq('usuario_id', cambios.peritoId)
      .maybeSingle();
    if (errorPerito) throw new Error('No se pudo consultar el perito');
    if (!perito || perito.estado === 'INACTIVO')
      throw new AppError('SIN_PERMISO', 403, 'Se requiere un perito activo');
    const fila: Record<string, unknown> = {
      perito_id: perito.id,
      dictamen_final: cambios.dictamenFinal,
      observaciones_perito: cambios.observacionesPerito,
      kilometraje: cambios.kilometraje,
    };
    if (cambios.costoTotalEstimado !== null) {
      fila.costo_total_estimado = cambios.costoTotalEstimado;
    }
    const { error } = await tabla(getAdminClient(), 'inspecciones_periciales')
      .update(fila)
      .eq('id', inspeccionId);
    if (error) {
      throw new Error(`No se pudo registrar el dictamen: ${error.message}`);
    }
  }

  async crearEvaluaciones(evaluaciones: CrearEvaluacionInput[]): Promise<void> {
    if (evaluaciones.length === 0) return;
    const filas = evaluaciones.map((ev) => ({
      inspeccion_id: ev.inspeccionId,
      codigo_pieza: ev.codigoPieza,
      accion_requerida: ev.accionRequerida,
      horas_mano_obra: ev.horasManoObra,
      costo_pieza_estimado: ev.costoPiezaEstimado,
      confianza: ev.confianza,
      imagen_id: ev.imagenId,
      bbox: ev.bbox,
    }));
    const { error } = await tabla(getAdminClient(), 'evaluacion_detallada_danos').insert(filas);
    if (error) {
      throw new Error(`No se pudieron crear las evaluaciones: ${error.message}`);
    }
  }

  async listarEvaluacionesPorInspeccion(inspeccionId: string): Promise<EvaluacionDanos[]> {
    const { data, error } = await tabla(getAdminClient(), 'evaluacion_detallada_danos')
      .select()
      .eq('inspeccion_id', inspeccionId);
    if (error || !data) return [];
    return (data as unknown as Record<string, unknown>[]).map(aEvaluacion);
  }

  async obtenerEvaluacionPorId(id: string): Promise<EvaluacionDanos | null> {
    const { data, error } = await tabla(getAdminClient(), 'evaluacion_detallada_danos')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return aEvaluacion(data as unknown as Record<string, unknown>);
  }

  async actualizarEvaluacion(evaluacionId: string, cambios: CambiosEvaluacion): Promise<void> {
    const fila: Record<string, unknown> = {};
    if (cambios.accionRequerida !== undefined) fila.accion_requerida = cambios.accionRequerida;
    if (cambios.costoPiezaEstimado !== undefined) {
      fila.costo_pieza_estimado = cambios.costoPiezaEstimado;
    }
    if (cambios.aprobadoPorPerito !== undefined) {
      fila.aprobado_por_perito = cambios.aprobadoPorPerito;
    }
    if (cambios.observacionPieza !== undefined) {
      fila.observacion_pieza = cambios.observacionPieza;
    }
    const { error } = await tabla(getAdminClient(), 'evaluacion_detallada_danos')
      .update(fila)
      .eq('id', evaluacionId);
    if (error) {
      throw new Error(`No se pudo ajustar la evaluación: ${error.message}`);
    }
  }
}

/** Implementación Supabase del baremo. */
export class SupabaseBaremoRepository implements BaremoRepository {
  async obtenerTodo(): Promise<Map<string, EntradaBaremo>> {
    const { data, error } = await tabla(getAdminClient(), 'baremo_mock').select(
      'codigo_pieza, costo_repuesto_base, horas_mano_obra, costo_hora_mo',
    );
    if (error || !data) {
      throw new Error(`No se pudo cargar el baremo: ${error?.message ?? 'sin datos'}`);
    }
    const mapa = new Map<string, EntradaBaremo>();
    for (const fila of data as unknown as {
      codigo_pieza: string;
      costo_repuesto_base: number;
      horas_mano_obra: number;
      costo_hora_mo: number;
    }[]) {
      mapa.set(fila.codigo_pieza, {
        costo_repuesto_base: fila.costo_repuesto_base,
        horas_mano_obra: fila.horas_mano_obra,
        costo_hora_mo: fila.costo_hora_mo,
      });
    }
    return mapa;
  }
}

/** Implementación Supabase de la auditoría. */
export class SupabaseAuditRepository implements AuditRepository {
  async registrar(input: RegistrarAuditoriaInput): Promise<void> {
    const { error } = await tabla(getAdminClient(), 'audit_log').insert({
      entidad: input.entidad,
      entidad_id: input.entidadId,
      accion: input.accion,
      actor_tipo: input.actorTipo,
      actor_id: input.actorId ?? null,
      datos: input.datos ?? null,
    });
    if (error) {
      throw new Error(`No se pudo registrar la auditoría: ${error.message}`);
    }
  }

  async listarPorEntidad(entidad: string, entidadId: string): Promise<RegistroAuditoria[]> {
    const { data, error } = await tabla(getAdminClient(), 'audit_log')
      .select()
      .eq('entidad', entidad)
      .eq('entidad_id', entidadId)
      .order('creado_en', { ascending: true });
    if (error) throw new Error('No se pudo consultar la auditoría');
    if (!data) return [];
    return (data as unknown as Record<string, unknown>[]).map((fila) => ({
      id: fila.id as string,
      entidad: fila.entidad as string,
      entidadId: fila.entidad_id as string,
      accion: fila.accion as string,
      actorTipo: fila.actor_tipo as string,
      actorId: (fila.actor_id as string | null) ?? null,
      datos: fila.datos ?? null,
      creadoEn: fila.creado_en as string,
    }));
  }
}
