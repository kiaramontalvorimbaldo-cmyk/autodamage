import { cache } from 'react';
import { requireUser } from '@/lib/auth/require-user';
import { AppError } from '@/lib/errors';
import type { Rol } from '@/domain/types';
export type Perfil = { nombre: string; rol: Rol };
export const obtenerPerfilActual = cache(async (): Promise<Perfil | null> => {
  try {
    const user = await requireUser();
    return { nombre: user.nombre, rol: user.rol };
  } catch (error) {
    if (error instanceof AppError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
});
