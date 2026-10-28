import { z } from 'zod';

/**
 * Esquema de creación de siniestro.
 * Coordenadas en rangos válidos; fecha del incidente ISO 8601.
 */
export const crearSiniestroSchema = z.object({
  solicitud_id: z.string().uuid().optional(),
  vehiculo_id: z.string().uuid('El vehículo debe ser un UUID válido'),
  descripcion: z
    .string()
    .max(2000, 'La descripción debe tener como máximo 2000 caracteres')
    .nullable()
    .optional(),
  latitud: z
    .number()
    .min(-90, 'La latitud debe estar entre -90 y 90')
    .max(90, 'La latitud debe estar entre -90 y 90'),
  longitud: z
    .number()
    .min(-180, 'La longitud debe estar entre -180 y 180')
    .max(180, 'La longitud debe estar entre -180 y 180'),
  fecha_incidente: z.string().datetime('La fecha del incidente debe ser ISO 8601'),
});

/**
 * Metadatos de una imagen subida (el archivo viene aparte en multipart).
 */
export const metadatosImagenSchema = z.object({
  imagen_id: z.string().uuid().optional(),
  ampliacion_id: z.string().uuid().optional(),
  capturada_en: z.string().datetime('La fecha de captura debe ser ISO 8601'),
  latitud: z.number().min(-90).max(90).nullable().optional(),
  longitud: z.number().min(-180).max(180).nullable().optional(),
  precision_gps_m: z.number().min(0).max(100_000).nullable().optional(),
  orden: z.number().int().min(0).max(100).default(0),
  rostros_difuminados: z.boolean().default(false),
});

export type CrearSiniestroInput = z.infer<typeof crearSiniestroSchema>;
export type MetadatosImagenInput = z.infer<typeof metadatosImagenSchema>;

/**
 * Filtros y paginación de GET /api/siniestros.
 */
export const listaSiniestrosSchema = z.object({
  bandeja: z.enum(['pendientes', 'seguimiento', 'resueltos']).optional(),
  ruta: z.enum(['VERDE', 'AMARILLA', 'ROJA']).optional(),
  estado: z
    .enum(['PENDIENTE', 'FAST_TRACK', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'FINALIZADO'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListaSiniestrosInput = z.infer<typeof listaSiniestrosSchema>;
