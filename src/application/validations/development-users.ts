import { z } from 'zod';
import type { DevelopmentUserInput } from '../ports/development-user-repository';
const base = {
  email: z
    .string()
    .trim()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8),
  nombre: z.string().trim().min(2),
};
export const developmentUserSchema = z.discriminatedUnion('rol', [
  z.object({ ...base, rol: z.literal('ASEGURADO') }),
  z.object({ ...base, rol: z.literal('ADMIN') }),
  z.object({ ...base, rol: z.literal('PERITO'), numeroLicencia: z.string().trim().min(1) }),
  z.object({ ...base, rol: z.literal('TALLER'), nombreTaller: z.string().trim().min(1) }),
]);
const batchSchema = z.array(developmentUserSchema).superRefine((users, ctx) => {
  const seen = new Set<string>();
  users.forEach((user, index) => {
    if (seen.has(user.email))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, 'email'],
        message: 'Los correos de las cuentas de desarrollo deben ser diferentes.',
      });
    seen.add(user.email);
  });
});
type RawEnvironment = Record<string, string | undefined>;
export function developmentUserDrafts(env: RawEnvironment) {
  return [
    {
      email: env.DEV_ASEGURADO_EMAIL ?? 'asegurado@autodamage.test',
      password: env.DEV_ASEGURADO_PASSWORD ?? '',
      nombre: 'Ana Asegurado',
      rol: 'ASEGURADO' as const,
    },
    {
      email: env.DEV_PERITO_EMAIL ?? 'perito@autodamage.test',
      password: env.DEV_PERITO_PASSWORD ?? '',
      nombre: 'Carlos Perito',
      rol: 'PERITO' as const,
      numeroLicencia: 'LIC-000001',
    },
    {
      email: env.DEV_TALLER_1_EMAIL ?? 'taller1@autodamage.test',
      password: env.DEV_TALLER_1_PASSWORD ?? '',
      nombre: 'Taller El Freno',
      rol: 'TALLER' as const,
      nombreTaller: 'Taller El Freno',
    },
    {
      email: env.DEV_TALLER_2_EMAIL ?? 'taller2@autodamage.test',
      password: env.DEV_TALLER_2_PASSWORD ?? '',
      nombre: 'Taller La Carrocería',
      rol: 'TALLER' as const,
      nombreTaller: 'Taller La Carrocería',
    },
    {
      email: env.DEV_ADMIN_EMAIL ?? 'admin@autodamage.test',
      password: env.DEV_ADMIN_PASSWORD ?? '',
      nombre: 'Dana Admin',
      rol: 'ADMIN' as const,
    },
  ];
}
export function readDevelopmentUsers(env: RawEnvironment): DevelopmentUserInput[] {
  return batchSchema.parse(developmentUserDrafts(env));
}
export function developmentUsersPlan(env: RawEnvironment) {
  return developmentUserDrafts(env).map((user) => ({
    email: user.email.trim().toLowerCase(),
    rol: user.rol,
    passwordConfigured: user.password.length >= 8,
  }));
}
