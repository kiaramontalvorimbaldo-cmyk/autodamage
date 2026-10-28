import { ApiError } from '@/lib/api-client';

/**
 * Mensajes visibles al usuario en español, sin jerga técnica.
 * Ningún componente escribe textos de error directamente: todos pasan por aquí.
 */

/** Mensaje por defecto cuando el código de error no se conoce. */
export const MENSAJE_GENERICO = 'Ocurrió un problema inesperado. Inténtalo de nuevo.';

/** Campos de vehículo que pueden estar duplicados. */
type CampoDuplicado = 'matricula' | 'numero_poliza';

const MENSAJES: Record<string, string> = {
  FOTOS_INSUFICIENTES: 'Captura al menos 3 fotos antes de iniciar el análisis.',
  MIGRACION_PENDIENTE:
    'Falta aplicar la migración 005 en Supabase para guardar esta operación de forma segura.',
  SOLICITUD_CONFLICTIVA:
    'La solicitud ya corresponde a otro reporte o foto. Recarga el caso antes de continuar.',
  ERROR_GUARDAR_OPERACION: 'No se confirmó el cambio. Consulta el estado antes de reintentar.',
  CREDENCIALES_INVALIDAS: 'Revisa tu correo y contraseña.',
  REGISTRO_ERROR: 'No pudimos crear tu cuenta. Revisa tus datos e inténtalo de nuevo.',
  CONFIRMACION_PENDIENTE: 'Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.',
  BODY_INVALIDO: 'No pudimos leer la información enviada. Inténtalo de nuevo.',
  // Sesión y permisos
  NO_AUTENTICADO: 'Tu sesión terminó. Inicia sesión para continuar.',
  SIN_PERMISO: 'No tienes permiso para realizar esta acción.',
  NO_AUTORIZADO: 'No tienes permiso para realizar esta acción.',

  // Vehículos
  VEHICULO_DUPLICADO: 'Ya existe un vehículo registrado con esos datos.',
  VEHICULO_CON_SINIESTROS: 'No puedes eliminar un vehículo que ya tiene siniestros reportados.',
  VEHICULO_NO_ENCONTRADO: 'El vehículo ya no está disponible.',
  VEHICULO_AJENO: 'Este vehículo no está registrado a tu nombre.',

  // Captura de evidencias
  ARCHIVO_NO_EN_VIVO: 'La foto debe tomarse con la cámara, no desde la galería.',
  IMAGEN_INVALIDA: 'La foto no tiene un formato válido. Inténtalo de nuevo.',
  DEMASIADAS_IMAGENES: 'Ya alcanzaste el máximo de fotos por siniestro.',
  FOTO_DUPLICADA: 'Detectamos una foto repetida de otro caso. Un perito lo revisará.',
  ERROR_GPS: 'No pudimos obtener tu ubicación. Actívala o escribe las coordenadas.',

  // Análisis
  IA_NO_DISPONIBLE: 'El análisis automático no estuvo disponible. Un perito revisará tu caso.',
  CUOTA_AGOTADA:
    'El análisis automático se activó más veces de lo previsto por hoy. Inténtalo más tarde.',
  SIN_PIEZAS_VALIDAS: 'No se identificaron piezas dañadas. Un perito revisará tu caso.',
  BAJA_CONFIANZA: 'El análisis automático no fue concluyente. Un perito revisará tu caso.',

  // Siniestros
  SINIESTRO_NO_ENCONTRADO: 'No encontramos ese siniestro.',
  ESTADO_INVALIDO: 'Este caso ya cambió de estado y no admite esa acción.',
  RECHAZO_AUTOMATICO_PROHIBIDO: 'Solo un perito puede rechazar un caso.',
  AMPLIACION_REQUERIDA: 'Se solicitó información adicional del caso.',

  // Validación y servidor
  VALIDACION_ERROR: 'Revisa los datos ingresados e inténtalo de nuevo.',
  SIN_TALLERES_DISPONIBLES: 'Por ahora no hay talleres disponibles. Tu caso queda en revisión.',

  // Red
  SIN_CONEXION: 'No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.',
  TIEMPO_ESPIRADO: 'La operación tardó demasiado. Inténtalo de nuevo.',
  DEMASIADOS_INTENTOS: 'Has hecho demasiados intentos. Espera un momento e inténtalo de nuevo.',
};

/** Mensaje específico cuando el conflicto es de un campo concreto. */
const MENSAJES_CAMPO: Record<CampoDuplicado, string> = {
  matricula: 'Ya existe un vehículo registrado con esa matrícula.',
  numero_poliza: 'Ya existe un vehículo registrado con ese número de póliza.',
};

/** Traduce un código de error a un texto comprensible. */
export function mensajeDeCodigo(codigo: string, campo?: string): string {
  if (codigo === 'VEHICULO_DUPLICADO' && campo && campo in MENSAJES_CAMPO) {
    return MENSAJES_CAMPO[campo as CampoDuplicado];
  }
  return MENSAJES[codigo] ?? MENSAJE_GENERICO;
}

/** Extrae el campo_conflictivo de los detalles de un error de la API. */
function campoDeDetalle(details: unknown): string | undefined {
  if (details && typeof details === 'object' && 'campo' in details) {
    const campo = (details as { campo?: unknown }).campo;
    return typeof campo === 'string' ? campo : undefined;
  }
  return undefined;
}

/** Convierte cualquier error (de red, de la API o de la interfaz) en texto. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0 || error.code === 'SIN_CONEXION') return MENSAJES.SIN_CONEXION;
    return mensajeDeCodigo(error.code, campoDeDetalle(error.details));
  }
  if (error instanceof TypeError) {
    return MENSAJES.SIN_CONEXION;
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return MENSAJES.TIEMPO_ESPIRADO;
  }
  if (error instanceof Error && error.message && error.message !== 'Failed to fetch') {
    return MENSAJES.TIEMPO_ESPIRADO;
  }
  return MENSAJE_GENERICO;
}
