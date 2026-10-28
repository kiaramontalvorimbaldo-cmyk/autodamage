import type { Rol } from '@/domain/types';

export type CrearPersonalDatos = {
  tipo: 'PERITO' | 'TALLER';
  nombre: string;
  email: string;
  numeroLicencia?: string;
  nombreTaller?: string;
  direccion?: string;
  telefono?: string;
};

export type StaffCreado = {
  usuarioId: string;
  rol: Rol;
  passwordTemporal: string;
};

export interface StaffRepository {
  crearPersonal(input: CrearPersonalDatos): Promise<StaffCreado>;
  cambiarActivoPersonal(usuarioId: string, activo: boolean): Promise<void>;
}
