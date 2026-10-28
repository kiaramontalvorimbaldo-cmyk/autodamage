import type { StaffRepository, CrearPersonalDatos, StaffCreado } from '../ports/staff-repository';

export type { StaffCreado, CrearPersonalDatos };

export type ManageStaffDeps = {
  staffRepository: StaffRepository;
};

/**
 * Crea personal (PERITO o TALLER) desde el portal de administrador.
 * Delega la persistencia al puerto StaffRepository.
 */
export async function crearPersonal(
  depsOrInput: ManageStaffDeps | CrearPersonalDatos,
  maybeInput?: CrearPersonalDatos,
): Promise<StaffCreado> {
  if ('staffRepository' in depsOrInput) {
    if (!maybeInput) {
      throw new Error('Input requerido al proporcionar dependencias');
    }
    return depsOrInput.staffRepository.crearPersonal(maybeInput);
  }
  throw new Error('Inyección de dependencias requerida para crearPersonal');
}

/**
 * Activa o desactiva personal (PERITO o TALLER).
 * Delega la persistencia al puerto StaffRepository.
 */
export async function cambiarActivoPersonal(
  depsOrUsuarioId: ManageStaffDeps | string,
  usuarioIdOrActivo?: string | boolean,
  maybeActivo?: boolean,
): Promise<void> {
  if (typeof depsOrUsuarioId === 'object' && 'staffRepository' in depsOrUsuarioId) {
    const usuarioId = usuarioIdOrActivo as string;
    const activo = maybeActivo as boolean;
    return depsOrUsuarioId.staffRepository.cambiarActivoPersonal(usuarioId, activo);
  }
  throw new Error('Inyección de dependencias requerida para cambiarActivoPersonal');
}
