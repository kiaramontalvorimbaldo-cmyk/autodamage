import { z } from 'zod';

/**
 * Esquema Zod de la respuesta de la IA.
 * Valida localmente la respuesta; analisisIaJsonSchema define el contrato
 * JSON serializable que se envía a Gemini.
 */
export const analisisIaSchema = z.object({
  vehiculo: z.object({
    marca: z.string().nullable(),
    modelo: z.string().nullable(),
  }),
  piezas_detectadas: z.array(
    z.object({
      codigo_pieza: z.string().min(1, 'El código de pieza es obligatorio'),
      accion: z.enum(['REPARAR', 'PINTAR', 'SUSTITUIR']),
      evidencia_visible: z.string().max(1000).optional(),
      confianza: z.number().min(0, 'La confianza debe ser 0–1').max(1, 'La confianza debe ser 0–1'),
      imagen_indice: z.number().int().min(0, 'El índice de imagen debe ser ≥ 0'),
      /** [ymin, xmin, ymax, xmax] normalizado 0–1000 */
      bbox: z
        .tuple([
          z.number().min(0).max(1000),
          z.number().min(0).max(1000),
          z.number().min(0).max(1000),
          z.number().min(0).max(1000),
        ])
        .refine(([ymin, xmin, ymax, xmax]) => ymin < ymax && xmin < xmax, {
          message: 'La caja debe tener alto y ancho positivos',
        }),
    }),
  ),
  nivel_severidad: z.enum(['LEVE', 'MODERADO', 'SEVERO']),
  indicadores_estructurales: z.object({
    dano_estructural: z.boolean(),
    airbags: z.boolean(),
    perdida_total: z.boolean(),
  }),
  sospecha_recaptura: z.boolean(),
  motivo_recaptura: z.string().nullable(),
  confianza_global: z
    .number()
    .min(0, 'La confianza global debe ser 0–1')
    .max(1, 'La confianza global debe ser 0–1'),
});

export type AnalisisIaBruto = z.infer<typeof analisisIaSchema>;

/** JSON Schema enviado a Google; Zod se usa después para validar la respuesta. */
export const analisisIaJsonSchema = {
  type: 'object',
  required: [
    'vehiculo',
    'piezas_detectadas',
    'nivel_severidad',
    'indicadores_estructurales',
    'sospecha_recaptura',
    'motivo_recaptura',
    'confianza_global',
  ],
  properties: {
    vehiculo: {
      type: 'object',
      required: ['marca', 'modelo'],
      properties: { marca: { type: ['string', 'null'] }, modelo: { type: ['string', 'null'] } },
    },
    piezas_detectadas: {
      type: 'array',
      items: {
        type: 'object',
        required: ['codigo_pieza', 'accion', 'confianza', 'imagen_indice', 'bbox'],
        properties: {
          codigo_pieza: { type: 'string' },
          accion: { type: 'string', enum: ['REPARAR', 'PINTAR', 'SUSTITUIR'] },
          evidencia_visible: { type: 'string', maxLength: 1000 },
          confianza: { type: 'number', minimum: 0, maximum: 1 },
          imagen_indice: { type: 'integer', minimum: 0 },
          bbox: {
            type: 'array',
            items: { type: 'number', minimum: 0, maximum: 1000 },
            minItems: 4,
            maxItems: 4,
          },
        },
      },
    },
    nivel_severidad: { type: 'string', enum: ['LEVE', 'MODERADO', 'SEVERO'] },
    indicadores_estructurales: {
      type: 'object',
      required: ['dano_estructural', 'airbags', 'perdida_total'],
      properties: {
        dano_estructural: { type: 'boolean' },
        airbags: { type: 'boolean' },
        perdida_total: { type: 'boolean' },
      },
    },
    sospecha_recaptura: { type: 'boolean' },
    motivo_recaptura: { type: ['string', 'null'] },
    confianza_global: { type: 'number', minimum: 0, maximum: 1 },
  },
} as const;
