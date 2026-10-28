import type { NextRequest } from 'next/server';
import type { Rol } from '@/domain/types';
import { requireUser } from '@/lib/auth/require-user';
import { AppError } from '@/lib/errors';
import { mensajeDeCodigo } from '@/lib/user-messages';
export type Sesion = { usuarioId: string; rol: Rol };
export async function obtenerSesion(_request: NextRequest): Promise<Sesion | null> {
  try {
    const user = await requireUser();
    return { usuarioId: user.usuarioId, rol: user.rol };
  } catch (error) {
    if (error instanceof AppError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}
export function respuestaNoAutenticado(): Response {
  return Response.json(
    { error: { code: 'NO_AUTENTICADO', message: mensajeDeCodigo('NO_AUTENTICADO') } },
    { status: 401 },
  );
}
export function respuestaSinPermiso(): Response {
  return Response.json(
    { error: { code: 'SIN_PERMISO', message: mensajeDeCodigo('SIN_PERMISO') } },
    { status: 403 },
  );
}
export async function requerirSesion(
  request: NextRequest,
  rolesPermitidos?: Rol[],
): Promise<{ sesion: Sesion } | { respuesta: Response }> {
  const sesion = await obtenerSesion(request);
  if (!sesion) return { respuesta: respuestaNoAutenticado() };
  if (rolesPermitidos && !rolesPermitidos.includes(sesion.rol))
    return { respuesta: respuestaSinPermiso() };
  return { sesion };
}
