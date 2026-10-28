import type {
  DevelopmentUserInput,
  DevelopmentUserRepository,
} from '../ports/development-user-repository';
import { AppError } from '@/lib/errors';
export type ProvisionedDevelopmentUser = {
  usuarioId: string;
  email: string;
  rol: DevelopmentUserInput['rol'];
  estado: 'CREADO' | 'EXISTENTE';
};
/** Compensación por cuenta: nunca borra ni cambia una cuenta preexistente. */
export async function provisionDevelopmentUser(
  repository: DevelopmentUserRepository,
  input: DevelopmentUserInput,
): Promise<ProvisionedDevelopmentUser> {
  const existing = await repository.findExisting(input);
  if (existing) {
    if (existing.rol !== input.rol || !existing.personalCompleto)
      throw new AppError(
        'SEED_EXISTENTE_INCOMPATIBLE',
        409,
        'La cuenta existente no coincide con el rol o no tiene su ficha de personal. No se modificó.',
      );
    return {
      usuarioId: existing.usuarioId,
      email: input.email,
      rol: input.rol,
      estado: 'EXISTENTE',
    };
  }
  const usuarioId = await repository.createAuthUser(input);
  try {
    await repository.setRole(usuarioId, input.rol);
    if (input.rol === 'PERITO' || input.rol === 'TALLER')
      await repository.createStaff(usuarioId, input);
    return { usuarioId, email: input.email, rol: input.rol, estado: 'CREADO' };
  } catch (error) {
    try {
      await repository.deleteCreatedAuthUser(usuarioId);
    } catch {
      throw new AppError(
        'SEED_REVERSION_FALLIDA',
        500,
        'No se pudo revertir la cuenta nueva. Revisa el correo que se estaba preparando antes de reintentar.',
        { usuarioId },
      );
    }
    if (error instanceof AppError) throw error;
    throw new AppError(
      'SEED_CREACION_FALLIDA',
      500,
      'No se pudo completar la cuenta nueva y se revirtió su creación.',
    );
  }
}
