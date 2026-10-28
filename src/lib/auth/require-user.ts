import { cache } from 'react';
import { createServerSupabaseClient } from '@/infrastructure/supabase/server-client';
import { AppError } from '@/lib/errors';
import { mensajeDeCodigo } from '@/lib/user-messages';
import { esRol } from '@/lib/portal-routes';
import type { Rol } from '@/domain/types';

export type UsuarioSesion = { usuarioId: string; nombre: string; rol: Rol };

/** React comparte la resolución solo dentro de la petición de render actual. */
export const requireUser = cache(async (): Promise<UsuarioSesion> => {
  const client = await createServerSupabaseClient();
  const claims = await client.auth.getClaims();
  let usuarioId = claims.data?.claims.sub;
  if (claims.error || typeof usuarioId !== 'string') {
    const fallback = await client.auth.getUser();
    if (fallback.error || !fallback.data.user)
      throw new AppError('NO_AUTENTICADO', 401, mensajeDeCodigo('NO_AUTENTICADO'));
    usuarioId = fallback.data.user.id;
  }
  const { data, error } = await client
    .from('usuarios')
    .select('nombre_completo, rol')
    .eq('id', usuarioId)
    .maybeSingle<{ nombre_completo: string; rol: string }>();
  if (error || !data || !esRol(data.rol))
    throw new AppError('SIN_PERMISO', 403, mensajeDeCodigo('SIN_PERMISO'));
  return { usuarioId, nombre: data.nombre_completo, rol: data.rol };
});
