/**
 * Tipos compartidos del dominio (glosario de AutoDamage AI).
 */
export type Rol = 'ASEGURADO' | 'PERITO' | 'TALLER' | 'ADMIN';
export type Severidad = 'LEVE' | 'MODERADO' | 'SEVERO';
export type Accion = 'REPARAR' | 'PINTAR' | 'SUSTITUIR';
export type Ruta = 'VERDE' | 'AMARILLA' | 'ROJA';
export type EstadoSiniestro =
  'PENDIENTE' | 'FAST_TRACK' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO' | 'FINALIZADO';
export type EstadoAnalisis = 'NO_INICIADO' | 'EN_PROCESO' | 'COMPLETADO' | 'FALLIDO';
export type TipoInspeccion = 'DIGITAL_IA' | 'PRESENCIAL';
export type DictamenFinal = 'APROBADO' | 'RECHAZADO' | 'AMPLIACION_REQUERIDA';
export type VerdictFraude =
  | 'SIN_RIESGO'
  | 'SOSPECHA_RECAPTURA'
  | 'INCONSISTENCIA_GPS'
  | 'INCONSISTENCIA_TEMPORAL'
  | 'FOTO_DUPLICADA';
export type EstadoOrden = 'EMITIDA' | 'RECIBIDO' | 'EN_REPARACION' | 'COMPLETADO';
export type Etiqueta =
  | 'IA_NO_DISPONIBLE'
  | 'SIN_PIEZAS_VALIDAS'
  | 'BAJA_CONFIANZA'
  | 'CODIGOS_DESCONOCIDOS'
  | 'AMPLIACION_RECIBIDA';
