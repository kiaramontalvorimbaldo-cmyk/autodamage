import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  DevelopmentUserRepository,
  DevelopmentUserInput,
  ExistingDevelopmentUser,
} from '@/application/ports/development-user-repository';
import type { Rol } from '@/domain/types';
import { esRol } from '@/lib/portal-routes';
import { AppError } from '@/lib/errors';
export class SupabaseDevelopmentUserRepository implements DevelopmentUserRepository {
  constructor(private readonly client: SupabaseClient) {}
  async findExisting(input: DevelopmentUserInput): Promise<ExistingDevelopmentUser | null> {
    const perPage = 200;
    let page = 1;
    while (true) {
      const { data, error } = await this.client.auth.admin.listUsers({ page, perPage });
      if (error)
        throw new AppError(
          'SEED_BUSQUEDA_FALLIDA',
          500,
          'No se pudieron consultar las cuentas existentes.',
        );
      const user = data.users.find(
        (user) => user.email?.toLowerCase() === input.email.toLowerCase(),
      );
      if (user) {
        const profile = await this.client
          .from('usuarios')
          .select('rol')
          .eq('id', user.id)
          .maybeSingle<{ rol: string }>();
        if (profile.error)
          throw new AppError(
            'SEED_BUSQUEDA_FALLIDA',
            500,
            'No se pudo comprobar el perfil existente.',
          );
        const rol = profile.data && esRol(profile.data.rol) ? profile.data.rol : null;
        let personalCompleto = true;
        if (input.rol === 'PERITO' || input.rol === 'TALLER') {
          const staff = await this.client
            .from(input.rol === 'PERITO' ? 'peritos' : 'talleres')
            .select('id')
            .eq('usuario_id', user.id)
            .maybeSingle<{ id: string }>();
          if (staff.error)
            throw new AppError(
              'SEED_BUSQUEDA_FALLIDA',
              500,
              'No se pudo comprobar la ficha de personal.',
            );
          personalCompleto = !!staff.data;
        }
        return { usuarioId: user.id, rol, personalCompleto };
      }
      if (data.users.length < perPage) return null;
      page++;
    }
  }
  async createAuthUser(input: DevelopmentUserInput): Promise<string> {
    const { data, error } = await this.client.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { nombre_completo: input.nombre },
    });
    if (error || !data.user)
      throw new AppError(
        'SEED_AUTH_FALLIDA',
        500,
        'No se pudo crear la cuenta de desarrollo. No se cambiaron cuentas existentes.',
      );
    return data.user.id;
  }
  async setRole(usuarioId: string, rol: Rol): Promise<void> {
    const { data, error } = await this.client
      .from('usuarios')
      .update({ rol })
      .eq('id', usuarioId)
      .select('id')
      .maybeSingle<{ id: string }>();
    if (error || !data)
      throw new AppError('SEED_ROL_FALLIDO', 500, 'No se pudo asignar el rol de la cuenta nueva.');
  }
  async createStaff(usuarioId: string, input: DevelopmentUserInput): Promise<void> {
    if (input.rol === 'PERITO') {
      const { error } = await this.client
        .from('peritos')
        .insert({ usuario_id: usuarioId, numero_licencia: input.numeroLicencia });
      if (error)
        throw new AppError(
          'SEED_PERSONAL_FALLIDO',
          500,
          'No se pudo completar la ficha del perito.',
        );
    } else if (input.rol === 'TALLER') {
      const { error } = await this.client
        .from('talleres')
        .insert({ usuario_id: usuarioId, nombre: input.nombreTaller });
      if (error)
        throw new AppError(
          'SEED_PERSONAL_FALLIDO',
          500,
          'No se pudo completar la ficha del taller.',
        );
    }
  }
  async deleteCreatedAuthUser(usuarioId: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(usuarioId);
    if (error)
      throw new AppError(
        'SEED_REVERSION_FALLIDA',
        500,
        'No se pudo eliminar la cuenta nueva incompleta.',
      );
  }
}
export function developmentUserRepository(
  url: string,
  serviceRoleKey: string,
): DevelopmentUserRepository {
  return new SupabaseDevelopmentUserRepository(
    createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  );
}
