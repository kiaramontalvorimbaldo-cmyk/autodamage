import { AppError } from '@/lib/errors';
import { getEnv } from '@/lib/env';
import {
  calcularVerdictFraude,
  esCapturaInconsistente,
  type BandasFraude,
} from '@/domain/fraud/verdict';
import { excedeUmbralGps } from '@/domain/fraud/geo';
import { hammingDistanceHex } from '@/domain/fraud/hash';
import { calcularCostos } from '@/domain/cost/cost';
import { triage } from '@/domain/triage/triage';
import { HAMMING_MAX_DUPLICADO } from '@/domain/config';
import {
  AiInvalidResponseError,
  AiUnavailableError,
  type AiProvider,
  type AnalisisIA,
} from '@/application/ports/ai-provider';
import type { AuditRepository } from '@/application/ports/audit-repository';
import type { BaremoRepository } from '@/application/ports/baremo-repository';
import type { CrearInspeccionInput, CambiosSiniestro } from '@/application/ports/claim-repository';
import type { RegistrarAuditoriaInput } from '@/application/ports/audit-repository';
import type { ClaimRepository } from '@/application/ports/claim-repository';
import type { Clock } from '@/application/ports/clock';
import type { RateLimiter } from '@/application/ports/rate-limiter';
import type { StorageService } from '@/application/ports/storage-service';
import type { WorkOrderRepository } from '@/application/ports/work-order-repository';
import { issueWorkOrder } from './issue-work-order';

export type AnalizarClaimDeps = {
  repositorio: ClaimRepository;
  baremo: BaremoRepository;
  almacen: StorageService;
  proveedorIa: AiProvider;
  limitadorRpm: RateLimiter;
  auditoria: AuditRepository;
  reloj: Clock;
  /** Opcional: al terminar en ruta VERDE se emite la orden de trabajo. */
  ordenes?: WorkOrderRepository;
};

export type ResultadoAnalisis = {
  ruta: string;
  estado: string;
  etiquetas: string[];
  costoTotalUsd: number;
  piezasValidas: number;
};

/**
 * Ejecuta el análisis completo de un siniestro:
 * (1) cuota diaria y límite RPM → degradación si se exceden;
 * (2) banderas de fraude deterministas (GPS, tiempo, duplicados);
 * (3) llamada a la IA;
 * (4) filtrado de piezas contra el baremo y cálculo de costos;
 * (5) veredicto de fraude combinado;
 * (6) triaje;
 * (7) persistencia de inspección + evaluaciones + actualización;
 * (8) auditoría (IA y SISTEMA).
 *
 * Ante fallo inesperado: analisis_estado = FALLIDO + auditoría + rethrow.
 * Si la IA no está disponible: degradación a AMARILLA con IA_NO_DISPONIBLE.
 */
export async function analyzeClaim(
  deps: AnalizarClaimDeps,
  siniestroId: string,
  aseguradoId: string,
): Promise<ResultadoAnalisis> {
  let token: string | null = null;
  try {
    const siniestro = await deps.repositorio.obtenerSiniestroPorId(siniestroId);
    if (!siniestro) {
      throw new AppError('SINIESTRO_NO_ENCONTRADO', 404, 'El siniestro no existe');
    }
    if (siniestro.aseguradoId !== aseguradoId) {
      throw new AppError('SINIESTRO_AJENO', 403, 'El siniestro no te pertenece');
    }

    token = siniestro.analisisToken ?? null;
    const imagenes = await deps.repositorio.listarImagenes(siniestroId);
    if (imagenes.length === 0) {
      throw new AppError('SIN_IMAGENES', 409, 'El siniestro no tiene imágenes para analizar');
    }
    if (siniestro.analisisEstado === 'COMPLETADO') {
      throw new AppError('ANALISIS_YA_COMPLETADO', 409, 'El siniestro ya fue analizado');
    }

    const ahora = deps.reloj.ahora();
    const env = getEnv();
    const mapaBaremo = await deps.baremo.obtenerTodo();

    // (1) Cuota diaria y límite por minuto
    let iaDisponible = true;
    const inspeccionesHoy = await deps.repositorio.contarInspeccionesDigitalIaHoy(ahora);
    if (inspeccionesHoy >= env.DAILY_AI_QUOTA_LIMIT) {
      iaDisponible = false;
    }
    if (!deps.limitadorRpm.intentar()) {
      iaDisponible = false;
    }

    // (2) Banderas de fraude deterministas
    let inconsistenciaGps = false;
    let inconsistenciaTemporal = false;
    for (const imagen of imagenes) {
      if (imagen.latitud !== null && imagen.longitud !== null) {
        if (
          excedeUmbralGps(
            { latitud: imagen.latitud, longitud: imagen.longitud },
            { latitud: siniestro.latitud, longitud: siniestro.longitud },
            imagen.precisionGpsM,
          )
        ) {
          inconsistenciaGps = true;
        }
      }
      if (
        esCapturaInconsistente(
          new Date(imagen.capturadaEn),
          imagen.recibidaEn ? new Date(imagen.recibidaEn) : ahora,
        )
      ) {
        inconsistenciaTemporal = true;
      }
    }

    let fotoDuplicada = false;
    const hashesOtrosSiniestros = await deps.repositorio.listarHashesDeOtrosSiniestros(siniestroId);
    for (const imagen of imagenes) {
      for (const hashOtro of hashesOtrosSiniestros) {
        if (hammingDistanceHex(imagen.hashPerceptual, hashOtro) <= HAMMING_MAX_DUPLICADO) {
          fotoDuplicada = true;
          break;
        }
      }
      if (fotoDuplicada) break;
    }

    // (3) Llamada a la IA
    let analisis: AnalisisIA | null = null;
    if (iaDisponible) {
      try {
        const imagenesBase64 = await Promise.all(
          imagenes.map(async (imagen) => {
            const contenido = await deps.almacen.descargar(imagen.storagePath);
            return { base64: contenido.toString('base64'), mimeType: 'image/jpeg' as const };
          }),
        );
        const vehiculo = await deps.repositorio.obtenerVehiculoPorId(siniestro.vehiculoId);
        analisis = await deps.proveedorIa.analizarDanos({
          imagenes: imagenesBase64,
          codigosPiezasValidos: [...mapaBaremo.keys()],
          contextoVehiculo: vehiculo
            ? { marca: vehiculo.marca, modelo: vehiculo.modelo }
            : undefined,
        });
      } catch (error) {
        if (error instanceof AiUnavailableError || error instanceof AiInvalidResponseError) {
          // Degradación controlada: continuamos sin IA.
          iaDisponible = false;
          await deps.auditoria.registrar({
            entidad: 'siniestro',
            entidadId: siniestroId,
            accion: 'ANALISIS_IA_DEGRADADO',
            actorTipo: 'IA',
            datos: { codigo: error.code, mensaje: error.message },
          });
        } else {
          throw error;
        }
      }
    }

    // (4) Costos contra el baremo
    const piezasDetectadas = analisis?.piezas_detectadas ?? [];
    const costos = calcularCostos(piezasDetectadas, mapaBaremo);
    const deteccionesValidas = piezasDetectadas.filter((pieza) =>
      mapaBaremo.has(pieza.codigo_pieza),
    );

    // (5) Veredicto de fraude
    const bandas: BandasFraude = {
      sospechaRecaptura: analisis?.sospecha_recaptura ?? false,
      fotoDuplicada,
      inconsistenciaGps,
      inconsistenciaTemporal,
    };
    const verdict = calcularVerdictFraude(bandas);

    // (6) Triaje
    const decision = triage(
      {
        severidad: analisis?.nivel_severidad ?? 'LEVE',
        estructurales: analisis
          ? {
              danoEstructural: analisis.indicadores_estructurales.dano_estructural,
              airbags: analisis.indicadores_estructurales.airbags,
              perdidaTotal: analisis.indicadores_estructurales.perdida_total,
            }
          : { danoEstructural: false, airbags: false, perdidaTotal: false },
        costoTotalUsd: costos.costoTotalUsd,
        verdictFraude: verdict.verdict,
        confianzaGlobal: analisis?.confianza_global ?? 0,
        iaDisponible,
        piezasValidas: costos.piezasValidas,
      },
      siniestro.etiquetas.includes('AMPLIACION_RECIBIDA'),
    );

    // (7) Persistencia
    const etiquetasFinales = [...new Set([...costos.etiquetas, ...decision.etiquetas])];
    const inspeccionInput: CrearInspeccionInput = {
      siniestroId,
      tipoInspeccion: decision.tipoInspeccion,
      verdictFraude: verdict.verdict,
      indicadoresFraude: verdict.indicadores,
      nivelSeveridad: analisis?.nivel_severidad ?? null,
      costoTotalEstimado: costos.costoTotalUsd,
      confianzaGlobal: analisis?.confianza_global ?? null,
      modeloIa: analisis
        ? deps.proveedorIa.versionPrompt.startsWith('mock-')
          ? 'mock'
          : env.GEMINI_MODEL
        : null,
      versionPrompt: analisis ? deps.proveedorIa.versionPrompt : null,
      respuestaIa: analisis ?? null,
    };

    const evaluacionesInput = costos.piezas.map((pieza, indice) => ({
      codigoPieza: pieza.codigo_pieza,
      accionRequerida: pieza.accion,
      horasManoObra: pieza.horas_mano_obra,
      costoPiezaEstimado: pieza.costo_pieza_estimado,
      confianza: deteccionesValidas[indice]?.confianza ?? null,
      imagenId: imagenes[deteccionesValidas[indice]?.imagen_indice ?? -1]?.id ?? null,
      bbox: deteccionesValidas[indice]?.bbox ?? null,
    }));

    const cambios: CambiosSiniestro = {
      estado: decision.estado,
      ruta: decision.ruta,
      etiquetas: etiquetasFinales,
      requiereInspeccionPresencial: decision.requiereInspeccionPresencial,
      analisisEstado: 'COMPLETADO',
    };

    const registros: RegistrarAuditoriaInput[] = [];
    // (8) Auditoría
    if (analisis) {
      registros.push({
        entidad: 'siniestro',
        entidadId: siniestroId,
        accion: 'ANALISIS_IA_COMPLETADO',
        actorTipo: 'IA',
        datos: {
          modeloIa: deps.proveedorIa.versionPrompt.startsWith('mock-') ? 'mock' : env.GEMINI_MODEL,
          versionPrompt: deps.proveedorIa.versionPrompt,
          severidad: analisis.nivel_severidad,
          piezasDetectadas: analisis.piezas_detectadas.length,
          confianzaGlobal: analisis.confianza_global,
        },
      });
    }
    registros.push({
      entidad: 'siniestro',
      entidadId: siniestroId,
      accion: 'TRIAJE_DECIDIDO',
      actorTipo: 'SISTEMA',
      datos: {
        ruta: decision.ruta,
        estado: decision.estado,
        tipoInspeccion: decision.tipoInspeccion,
        etiquetas: etiquetasFinales,
        razones: decision.razones,
        verdictFraude: verdict.verdict,
        indicadoresFraude: verdict.indicadores,
        costoTotalUsd: costos.costoTotalUsd,
      },
    });

    if (deps.repositorio.guardarAnalisisAtomico)
      await deps.repositorio.guardarAnalisisAtomico({
        token,
        inspeccion: inspeccionInput,
        evaluaciones: evaluacionesInput,
        cambios,
        auditoria: registros,
      });
    else {
      const inspeccion = await deps.repositorio.crearInspeccion(inspeccionInput);
      await deps.repositorio.crearEvaluaciones(
        evaluacionesInput.map((e) => ({ ...e, inspeccionId: inspeccion.id })),
      );
      await deps.repositorio.actualizarSiniestro(siniestroId, cambios);
      for (const registro of registros) await deps.auditoria.registrar(registro);
    }

    // (9) Ruta VERDE → orden de trabajo automática (idempotente).
    if (decision.ruta === 'VERDE' && deps.ordenes) {
      try {
        await issueWorkOrder(
          {
            repositorio: deps.repositorio,
            ordenes: deps.ordenes,
            auditoria: deps.auditoria,
          },
          siniestroId,
        );
      } catch {
        await deps.auditoria
          .registrar({
            entidad: 'siniestros',
            entidadId: siniestroId,
            accion: 'ORDEN_PENDIENTE',
            actorTipo: 'SISTEMA',
            datos: { motivo: 'No se pudo emitir la orden' },
          })
          .catch(() => undefined);
      }
    }

    return {
      ruta: decision.ruta,
      estado: decision.estado,
      etiquetas: etiquetasFinales,
      costoTotalUsd: costos.costoTotalUsd,
      piezasValidas: costos.piezasValidas,
    };
  } catch (error) {
    // Fallo inesperado: marcar FALLIDO, auditar y relanzar.
    const esAppError = error instanceof AppError;
    const esErrorDeCuota =
      error instanceof AiUnavailableError || error instanceof AiInvalidResponseError;
    if (!esAppError || esErrorDeCuota) {
      try {
        if (deps.repositorio.fallarAnalisis) {
          if (!(await deps.repositorio.fallarAnalisis(siniestroId, token))) throw error;
        } else
          await deps.repositorio.actualizarSiniestro(siniestroId, { analisisEstado: 'FALLIDO' });
        await deps.auditoria.registrar({
          entidad: 'siniestro',
          entidadId: siniestroId,
          accion: 'ANALISIS_FALLIDO',
          actorTipo: 'SISTEMA',
          datos: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      } catch {
        // Si la auditoría también falla, igualmente relanzamos el error original.
      }
    }
    throw error;
  }
}
