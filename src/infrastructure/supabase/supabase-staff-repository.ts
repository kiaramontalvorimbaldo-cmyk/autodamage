import { AppError } from '@/lib/errors';
import { randomBytes } from 'node:crypto';
import { getAdminClient } from '@/infrastructure/supabase/admin-client';
import { tabla } from '@/infrastructure/supabase/tabla';
import type {
  StaffRepository,
  CrearPersonalDatos,
  StaffCreado,
} from '@/application/ports/staff-repository';
import type { Rol } from '@/domain/types';

function generarPasswordTemporal(): string {
  return `Aa1!${randomBytes(18).toString('base64url')}`;
}

export class SupabaseStaffRepository implements StaffRepository {
  private get client() {
    return getAdminClient();
  }

  async crearPersonal(input: CrearPersonalDatos): Promise<StaffCreado> {
    const supabase = this.client;
    const passwordTemporal = generarPasswordTemporal();

    const { data: usuario, error } = await supabase.auth.admin.createUser({
      email: input.email,
      password: passwordTemporal,
      email_confirm: true,
      user_metadata: { nombre_completo: input.nombre },
    });

    if (error) {
      if (error.message.includes('already registered') || error.status === 422) {
        throw new AppError('CORREO_DUPLICADO', 409, 'Ya existe un usuario con ese correo');
      }
      throw new AppError('ERROR_CREAR_USUARIO', 500, 'No se pudo crear la cuenta');
    }

    const usuarioId = usuario.user.id;
    const rol: Rol = input.tipo;

    try {
      const { error: errorPerfil } = await tabla(supabase, 'usuarios')
        .update({ rol })
        .eq('id', usuarioId);
      if (errorPerfil)
        throw new AppError('ERROR_CREAR_USUARIO', 500, 'No se pudo completar el perfil');

      if (input.tipo === 'PERITO') {
        if (!input.numeroLicencia) {
          throw new AppError('DATOS_INVALIDOS', 400, 'Falta el número de licencia');
        }
        const { error: errorPerito } = await tabla(supabase, 'peritos').insert({
          usuario_id: usuarioId,
          numero_licencia: input.numeroLicencia,
        });
        if (errorPerito)
          throw new AppError(
            'ERROR_CREAR_PERITO',
            500,
            'No se pudo registrar el perito; comprueba la licencia',
          );
      } else {
        if (!input.nombreTaller) {
          throw new AppError('DATOS_INVALIDOS', 400, 'Falta el nombre del taller');
        }
        const { error: errorTaller } = await tabla(supabase, 'talleres').insert({
          usuario_id: usuarioId,
          nombre: input.nombreTaller,
          direccion: input.direccion ?? null,
          telefono: input.telefono ?? null,
        });
        if (errorTaller)
          throw new AppError('ERROR_CREAR_TALLER', 500, 'No se pudo registrar el taller');
      }

      return { usuarioId, rol, passwordTemporal };
    } catch (err) {
      const { error: limpieza } = await supabase.auth.admin.deleteUser(usuarioId);
      if (limpieza)
        throw new AppError(
          'PERSONAL_RECONCILIACION_PENDIENTE',
          502,
          'No se completó el alta y la eliminación compensatoria falló. Revisa Personal antes de reintentar.',
        );
      throw err;
    }
  }

  async cambiarActivoPersonal(usuarioId: string, activo: boolean): Promise<void> {
    const supabase = this.client;
    const { data: usuario, error: errorUsuario } = await tabla(supabase, 'usuarios')
      .select('rol')
      .eq('id', usuarioId)
      .maybeSingle();

    if (errorUsuario || !usuario) {
      throw new AppError('USUARIO_NO_ENCONTRADO', 404, 'El usuario no existe');
    }

    const rol = usuario.rol as Rol;
    let restaurar: (() => Promise<void>) | undefined;

    if (rol === 'PERITO') {
      const { data: perito } = await tabla(supabase, 'peritos')
        .select('id, estado')
        .eq('usuario_id', usuarioId)
        .maybeSingle();
      if (!perito) throw new AppError('PERITO_NO_ENCONTRADO', 404, 'No se encontró el perito');
      restaurar = async () => {
        const { error } = await tabla(supabase, 'peritos')
          .update({ estado: perito.estado })
          .eq('id', perito.id);
        if (error) throw error;
      };

      const { error } = await tabla(supabase, 'peritos')
        .update({ estado: activo ? 'ACTIVO' : 'INACTIVO' })
        .eq('id', perito.id);
      if (error) throw new AppError('ERROR_ACTUALIZAR_PERSONAL', 500);
    } else if (rol === 'TALLER') {
      const { data: taller } = await tabla(supabase, 'talleres')
        .select('id, activo')
        .eq('usuario_id', usuarioId)
        .maybeSingle();
      if (!taller) throw new AppError('TALLER_NO_ENCONTRADO', 404, 'No se encontró el taller');
      restaurar = async () => {
        const { error } = await tabla(supabase, 'talleres')
          .update({ activo: taller.activo })
          .eq('id', taller.id);
        if (error) throw error;
      };

      const { error } = await tabla(supabase, 'talleres').update({ activo }).eq('id', taller.id);
      if (error) throw new AppError('ERROR_ACTUALIZAR_PERSONAL', 500);
    } else {
      throw new AppError(
        'SIN_PERMISO',
        403,
        'Solo se puede gestionar personal de peritos y talleres',
      );
    }

    const { error } = await supabase.auth.admin.updateUserById(usuarioId, {
      ban_duration: activo ? 'none' : '10000000h',
    });
    if (error) {
      try {
        await restaurar?.();
      } catch {
        throw new AppError(
          'PERSONAL_RECONCILIACION_PENDIENTE',
          502,
          'No se pudo confirmar el estado de la cuenta. Revisa el usuario antes de continuar.',
        );
      }
      throw new AppError(
        'ERROR_ACTUALIZAR_PERSONAL',
        502,
        'No se pudo confirmar el acceso; se restauró el perfil anterior. Comprueba la cuenta antes de reintentar.',
      );
    }
  }
}
