import { z } from 'zod';

export const TIPOS_INCIDENTE = {
  COLISION_VEHICULO: 'Colisión con otro vehículo',
  COLISION_OBJETO: 'Colisión con un objeto',
  ESTACIONADO: 'Daño con el vehículo estacionado',
  VUELCO: 'Vuelco',
  OTRO: 'Otro incidente',
} as const;
export const RESPUESTAS_INCIDENTE = { SI: 'Sí', NO: 'No', NO_SE: 'No lo sé' } as const;

export const detallesIncidenteSchema = z
  .object({
    tipo: z.enum(['COLISION_VEHICULO', 'COLISION_OBJETO', 'ESTACIONADO', 'VUELCO', 'OTRO'], {
      message: 'Selecciona el tipo de incidente',
    }),
    lugar: z
      .string()
      .trim()
      .min(5, 'Indica la calle, zona o un punto de referencia (mínimo 5 caracteres)')
      .max(180),
    relato: z
      .string()
      .trim()
      .min(30, 'Explica cómo ocurrió el incidente (mínimo 30 caracteres)')
      .max(900),
    danos: z
      .string()
      .trim()
      .min(10, 'Indica las partes y daños que observas (mínimo 10 caracteres)')
      .max(350),
    otros_vehiculos: z.enum(['SI', 'NO', 'NO_SE'], {
      message: 'Indica si participaron otros vehículos',
    }),
    personas_heridas: z.enum(['SI', 'NO', 'NO_SE'], { message: 'Indica si hubo personas heridas' }),
  })
  .superRefine((data, context) => {
    if (data.tipo === 'COLISION_VEHICULO' && data.otros_vehiculos === 'NO') {
      context.addIssue({
        code: 'custom',
        path: ['otros_vehiculos'],
        message: 'Una colisión con otro vehículo debe indicar otro vehículo o «No lo sé»',
      });
    }
  });
export type DetallesIncidente = z.infer<typeof detallesIncidenteSchema>;
export type BorradorDetallesIncidente = { [K in keyof DetallesIncidente]: string };
export const DETALLES_INICIALES: BorradorDetallesIncidente = {
  tipo: '',
  lugar: '',
  relato: '',
  danos: '',
  otros_vehiculos: '',
  personas_heridas: '',
};

/** Resumen generado en el servidor; conserva el formato de los expedientes existentes. */
export function describirIncidente(detalles: DetallesIncidente) {
  return [
    'Tipo: ' + TIPOS_INCIDENTE[detalles.tipo],
    'Lugar de referencia: ' + detalles.lugar,
    'Descripción: ' + detalles.relato,
    'Daños observados: ' + detalles.danos,
    'Otros vehículos: ' + RESPUESTAS_INCIDENTE[detalles.otros_vehiculos],
    'Personas heridas: ' + RESPUESTAS_INCIDENTE[detalles.personas_heridas],
  ].join('\n');
}
