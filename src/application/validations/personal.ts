import { z } from 'zod';

export const crearPersonalSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('PERITO'),
    nombre: z.string().min(2).max(150),
    email: z.string().email('El correo debe ser válido'),
    numero_licencia: z.string().min(3).max(50),
  }),
  z.object({
    tipo: z.literal('TALLER'),
    nombre: z.string().min(2).max(150),
    email: z.string().email('El correo debe ser válido'),
    nombre_taller: z.string().min(2).max(150),
    direccion: z.string().max(500).optional(),
    telefono: z.string().max(30).optional(),
  }),
]);

export const cambiarActivoSchema = z.object({
  activo: z.boolean(),
});

export type CrearPersonalInput = z.infer<typeof crearPersonalSchema>;
export type CambiarActivoInput = z.infer<typeof cambiarActivoSchema>;
