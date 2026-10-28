import { z } from 'zod';

/**
 * Esquema del dictamen del perito (POST /api/siniestros/:id/dictamen).
 * Las observaciones son obligatorias al rechazar (human-in-the-loop).
 */
export const dictamenSchema = z
  .object({
    dictamen_final: z.enum(['APROBADO', 'RECHAZADO', 'AMPLIACION_REQUERIDA'], {
      message: 'El dictamen debe ser APROBADO, RECHAZADO o AMPLIACION_REQUERIDA',
    }),
    observaciones_perito: z.string().max(2000).nullable().optional(),
    kilometraje: z.number().int().min(0).max(1_000_000).nullable().optional(),
    ajustes: z
      .array(
        z.object({
          evaluacion_id: z.string().uuid('El ID de la evaluación debe ser un UUID'),
          accion_requerida: z.enum(['REPARAR', 'PINTAR', 'SUSTITUIR']).optional(),
          costo_pieza_estimado: z.number().min(0).optional(),
          aprobado_por_perito: z.boolean(),
          observacion_pieza: z.string().max(1000).nullable().optional(),
        }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.dictamen_final === 'RECHAZADO' || data.dictamen_final === 'AMPLIACION_REQUERIDA') {
      if (!data.observaciones_perito || data.observaciones_perito.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['observaciones_perito'],
          message: 'Indica el motivo del rechazo o qué información debe ampliar el asegurado',
        });
      }
    }
  });

export type DictamenInput = z.infer<typeof dictamenSchema>;
