import { redirect } from 'next/navigation';
import { requireUser } from './require-user';
import { portalPorRol } from '@/lib/portal-routes';
import { AppError } from '@/lib/errors';
import type { Rol } from '@/domain/types';

export async function requirePortalUser(rol: Rol) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AppError && (error.status === 401 || error.status === 403))
      redirect('/login');
    throw error;
  }
  if (user.rol !== rol) redirect(portalPorRol(user.rol));
  return user;
}
