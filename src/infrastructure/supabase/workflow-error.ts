import { AppError } from '@/lib/errors';
export function workflowError(error: { code?: string; message: string }): never {
  if (error.code === 'PGRST202' || error.code === '42883')
    throw new AppError(
      'MIGRACION_PENDIENTE',
      503,
      'Falta aplicar la migración 005 para guardar esta operación de forma segura',
    );
  const codes = [
    'SIN_PERMISO',
    'ESTADO_INVALIDO',
    'INSPECCION_CAMBIO',
    'EVALUACION_AJENA',
    'AJUSTE_DUPLICADO',
    'TRANSICION_INVALIDA',
    'VALIDACION_ERROR',
    'ORDEN_NO_ENCONTRADA',
    'SINIESTRO_NO_ENCONTRADO',
    'SIN_IMAGENES',
    'LIMITE_IMAGENES',
    'SOLICITUD_CONFLICTIVA',
    'SIN_TALLERES_DISPONIBLES',
    'SIN_COSTO_ESTIMADO',
  ];
  const code = codes.find((c) => error.message.includes(c));
  if (code)
    throw new AppError(
      code,
      code === 'SIN_PERMISO' || code === 'EVALUACION_AJENA'
        ? 403
        : code.endsWith('ENCONTRADA') || code.endsWith('ENCONTRADO')
          ? 404
          : 409,
      'La operación no es válida para el estado actual. Recarga el caso y revisa los datos.',
    );
  throw new AppError(
    'ERROR_GUARDAR_OPERACION',
    502,
    'No se confirmó el cambio. Consulta el estado antes de reintentar.',
  );
}
