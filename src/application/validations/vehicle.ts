import { z } from 'zod';

/**
 * Esquema de vehículo (matrícula, marca, modelo, número de póliza).
 * Usado en POST/PATCH /api/vehiculos y en el formulario del asegurado.
 *
 * Normaliza los textos: recorta extremos, colapsa espacios internos y
 * pasa la matrícula a mayúsculas, de modo que la base de datos y la
 * interfaz guardan siempre el mismo formato.
 */
export const vehiculoSchema = z.object({
  matricula: z
    .string({ required_error: 'La matrícula es obligatoria' })
    .trim()
    .min(1, 'La matrícula es obligatoria')
    .max(20, 'La matrícula debe tener como máximo 20 caracteres')
    .transform((valor) => valor.replace(/\s+/g, ' ').toUpperCase()),
  marca: z
    .string({ required_error: 'La marca es obligatoria' })
    .trim()
    .min(1, 'La marca es obligatoria')
    .max(50, 'La marca debe tener como máximo 50 caracteres')
    .transform((valor) => valor.replace(/\s+/g, ' ')),
  modelo: z
    .string({ required_error: 'El modelo es obligatorio' })
    .trim()
    .min(1, 'El modelo es obligatorio')
    .max(50, 'El modelo debe tener como máximo 50 caracteres')
    .transform((valor) => valor.replace(/\s+/g, ' ')),
  numero_poliza: z
    .string({ required_error: 'El número de póliza es obligatorio' })
    .trim()
    .min(1, 'El número de póliza es obligatorio')
    .max(50, 'El número de póliza debe tener como máximo 50 caracteres')
    .transform((valor) => valor.replace(/\s+/g, ' ')),
});

export type VehiculoInput = z.infer<typeof vehiculoSchema>;