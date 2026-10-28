import type { Rol } from '@/domain/types';
type DevelopmentUserBase = { email: string; password: string; nombre: string };
export type DevelopmentUserInput = DevelopmentUserBase &
  (
    | { rol: 'ASEGURADO' | 'ADMIN' }
    | { rol: 'PERITO'; numeroLicencia: string }
    | { rol: 'TALLER'; nombreTaller: string }
  );
export type ExistingDevelopmentUser = {
  usuarioId: string;
  rol: Rol | null;
  personalCompleto: boolean;
};
export interface DevelopmentUserRepository {
  findExisting(input: DevelopmentUserInput): Promise<ExistingDevelopmentUser | null>;
  createAuthUser(input: DevelopmentUserInput): Promise<string>;
  setRole(usuarioId: string, rol: Rol): Promise<void>;
  createStaff(usuarioId: string, input: DevelopmentUserInput): Promise<void>;
  deleteCreatedAuthUser(usuarioId: string): Promise<void>;
}
