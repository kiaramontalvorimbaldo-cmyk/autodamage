import { AppError } from '@/lib/errors';
import type { AuditRepository } from '../ports/audit-repository';
import type { BaremoRepository } from '../ports/baremo-repository';
import type { ClaimRepository, CambiosEvaluacion } from '../ports/claim-repository';
import { puedeTransicionar } from '@/domain/claim-state/claim-state';
import { admiteDictamen } from '@/domain/claim-state/review-flow';
import { costoPieza } from '@/domain/cost/cost';
import { roundMoney } from '@/domain/money';
import { issueWorkOrder } from './issue-work-order';
import type { WorkOrderRepository } from '../ports/work-order-repository';
import type { Accion, DictamenFinal, EstadoSiniestro } from '@/domain/types';

export type AjustePieza = {
  evaluacionId: string;
  accionRequerida?: Accion;
  costoPiezaEstimado?: number;
  aprobadoPorPerito: boolean;
  observacionPieza?: string | null;
};

export type IssueVerdictInput = {
  siniestroId: string;
  peritoId: string;
  dictamenFinal: DictamenFinal;
  observacionesPerito: string | null;
  kilometraje?: number | null;
  ajustes?: AjustePieza[];
};

export type IssueVerdictDeps = {
  repositorio: ClaimRepository;
  baremo: BaremoRepository;
  auditoria: AuditRepository;
  /** Opcional: al dictaminar APROBADO se emite la orden de trabajo. */
  ordenes?: WorkOrderRepository;
};

/**
 * Registra el dictamen de un PERITO sobre un siniestro en EN_REVISION.
 *
 * - Aplica los ajustes a las evaluaciones de pieza y recalcula el costo total.
 * - Persiste el dictamen en la inspección pericial.
 * - Mueve el siniestro con la máquina de estados:
 *     APROBADO → APROBADO · RECHAZADO → RECHAZADO · AMPLIACION_REQUERIDA → sigue EN_REVISION.
 * - Escribe auditoría (actor USUARIO) con valor anterior y nuevo.
 *
 * Principio Human-in-the-Loop: RECHAZADO solo llega aquí porque un PERITO
 * lo dictaminó; no existe rechazo automático.
 *
 * Nota de Sprint 3: aprobar aún NO crea la orden de trabajo (Sprint 4).
 */
export async function issueVerdict(
  deps: IssueVerdictDeps,
  input: IssueVerdictInput,
): Promise<EstadoSiniestro> {
  const siniestro = await deps.repositorio.obtenerSiniestroPorId(input.siniestroId);
  if (!siniestro) throw new AppError('SINIESTRO_NO_ENCONTRADO', 404);

  if (!admiteDictamen(siniestro)) {
    throw new AppError('ESTADO_INVALIDO', 409, 'Solo se puede dictaminar un siniestro en revisión');
  }

  const inspeccion = await deps.repositorio.obtenerInspeccionPorSiniestro(siniestro.id);
  if (!inspeccion) throw new AppError('INSPECCION_NO_ENCONTRADA', 404);

  // 1) Aplicar ajustes y recalcular el costo total estimado.
  const evaluaciones = await deps.repositorio.listarEvaluacionesPorInspeccion(inspeccion.id);
  const ajustesPorId = new Map((input.ajustes ?? []).map((a) => [a.evaluacionId, a]));

  // Validar el lote completo antes de modificar la primera evaluación.
  if (ajustesPorId.size !== (input.ajustes?.length ?? 0)) {
    throw new AppError(
      'AJUSTE_DUPLICADO',
      400,
      'Una evaluación solo admite un ajuste por dictamen',
    );
  }
  for (const ajuste of input.ajustes ?? []) {
    if (
      !evaluaciones.some((e) => e.id === ajuste.evaluacionId && e.inspeccionId === inspeccion.id)
    ) {
      throw new AppError('EVALUACION_AJENA', 403, 'La evaluación no pertenece a este siniestro');
    }
  }

  const lote: { id: string; cambios: CambiosEvaluacion }[] = [];
  let costoTotal = inspeccion.costoTotalEstimado;
  if (input.ajustes && input.ajustes.length > 0) {
    costoTotal = 0;
    const baremo = await deps.baremo.obtenerTodo();

    for (const ajuste of input.ajustes) {
      const evaluacion = evaluaciones.find((e) => e.id === ajuste.evaluacionId);
      if (!evaluacion || evaluacion.inspeccionId !== inspeccion.id) {
        throw new AppError('EVALUACION_AJENA', 403, 'La evaluación no pertenece a este siniestro');
      }

      const cambios: CambiosEvaluacion = {
        aprobadoPorPerito: ajuste.aprobadoPorPerito,
        observacionPieza: ajuste.observacionPieza ?? null,
      };

      if (ajuste.accionRequerida !== undefined) {
        cambios.accionRequerida = ajuste.accionRequerida;
      }
      if (ajuste.costoPiezaEstimado !== undefined) {
        cambios.costoPiezaEstimado = ajuste.costoPiezaEstimado;
      }
      if (ajuste.accionRequerida !== undefined && ajuste.costoPiezaEstimado === undefined) {
        const entrada = baremo.get(evaluacion.codigoPieza);
        if (entrada)
          cambios.costoPiezaEstimado = costoPieza(
            { codigo_pieza: evaluacion.codigoPieza, accion: ajuste.accionRequerida },
            entrada,
          );
      }
      lote.push({ id: ajuste.evaluacionId, cambios });
    }

    // Recálculo con los ajustes ya aplicados.
    for (const evaluacion of evaluaciones) {
      const ajuste = ajustesPorId.get(evaluacion.id);
      if (!(ajuste?.aprobadoPorPerito ?? evaluacion.aprobadoPorPerito)) continue;
      const accion = ajuste?.accionRequerida ?? evaluacion.accionRequerida;
      const entrada = baremo.get(evaluacion.codigoPieza);

      if (ajuste?.costoPiezaEstimado !== undefined) {
        costoTotal += ajuste.costoPiezaEstimado;
      } else if (entrada && ajuste?.accionRequerida !== undefined) {
        costoTotal += costoPieza({ codigo_pieza: evaluacion.codigoPieza, accion }, entrada);
      } else {
        // Código desconocido: se conserva el costo guardado por la IA.
        costoTotal += evaluacion.costoPiezaEstimado;
      }
    }
    costoTotal = roundMoney(costoTotal);
  }

  // 2) Persistir el dictamen en la inspección.
  const cambiosDictamen = {
    peritoId: input.peritoId,
    dictamenFinal: input.dictamenFinal,
    observacionesPerito: input.observacionesPerito,
    kilometraje: input.kilometraje ?? null,
    costoTotalEstimado:
      input.ajustes && input.ajustes.length > 0 ? costoTotal : inspeccion.costoTotalEstimado,
  };

  // 3) Mover el siniestro con la máquina de estados (lanza si es inválida).
  const estadoNuevo: EstadoSiniestro =
    input.dictamenFinal === 'APROBADO'
      ? 'APROBADO'
      : input.dictamenFinal === 'RECHAZADO'
        ? 'RECHAZADO'
        : 'EN_REVISION';

  puedeTransicionar(siniestro.estado, estadoNuevo, {
    rol: 'PERITO',
    dictamenFinal: input.dictamenFinal,
  });
  if (deps.repositorio.registrarDictamenAtomico) {
    await deps.repositorio.registrarDictamenAtomico({
      siniestroId: siniestro.id,
      inspeccionId: inspeccion.id,
      cambios: cambiosDictamen,
      ajustes: lote,
    });
  } else {
    for (const item of lote) await deps.repositorio.actualizarEvaluacion(item.id, item.cambios);
    await deps.repositorio.actualizarInspeccionDictamen(inspeccion.id, cambiosDictamen);
    await deps.repositorio.actualizarSiniestro(siniestro.id, {
      estado: estadoNuevo,
    });

    // 4) Auditoría con valor anterior y nuevo.
    await deps.auditoria.registrar({
      entidad: 'siniestros',
      entidadId: siniestro.id,
      accion: 'DICTAMEN_REGISTRADO',
      actorTipo: 'USUARIO',
      actorId: input.peritoId,
      datos: {
        dictamenFinal: input.dictamenFinal,
        estadoAnterior: siniestro.estado,
        estadoNuevo: estadoNuevo,
        costoAnterior: inspeccion.costoTotalEstimado,
        costoNuevo: costoTotal,
        observacionesPerito: input.observacionesPerito,
        kilometraje: input.kilometraje ?? null,
        numeroAjustes: input.ajustes?.length ?? 0,
      },
    });
  }

  // Aprobación del perito → orden de trabajo (idempotente).
  if (estadoNuevo === 'APROBADO' && deps.ordenes) {
    try {
      await issueWorkOrder(
        {
          repositorio: deps.repositorio,
          ordenes: deps.ordenes,
          auditoria: deps.auditoria,
        },
        siniestro.id,
        'USUARIO',
        input.peritoId,
      );
    } catch {
      // El dictamen ya está guardado: la orden se puede recuperar por separado.
      await deps.auditoria
        .registrar({
          entidad: 'siniestros',
          entidadId: siniestro.id,
          accion: 'ORDEN_PENDIENTE',
          actorTipo: 'SISTEMA',
          datos: { motivo: 'No se pudo emitir la orden' },
        })
        .catch(() => undefined);
    }
  }

  return estadoNuevo;
}
