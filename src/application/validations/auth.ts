import { z } from 'zod';

/**
 * Esquema de inicio de sesión.
 * Validación en el borde: formulario y Route Handler.
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'El correo electrónico es obligatorio' })
    .min(1, 'El correo electrónico es obligatorio')
    .email('El correo electrónico no es válido'),
  password: z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña es obligatoria')
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

/**
 * Esquema de registro público.
 * El registro siempre crea usuarios con rol ASEGURADO
 * (forzado por trigger en la base de datos).
 */
export const registroSchema = z.object({
  nombreCompleto: z
    .string({ required_error: 'El nombre completo es obligatorio' })
    .min(1, 'El nombre completo es obligatorio')
    .min(2, 'El nombre completo debe tener al menos 2 caracteres')
    .max(150, 'El nombre completo debe tener como máximo 150 caracteres'),
  email: z
    .string({ required_error: 'El correo electrónico es obligatorio' })
    .min(1, 'El correo electrónico es obligatorio')
    .email('El correo electrónico no es válido'),
  password: z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña es obligatoria')
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegistroInput = z.infer<typeof registroSchema>;
