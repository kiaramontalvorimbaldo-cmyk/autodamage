import type {
  ClaimRepository,
  FiltrosSiniestros,
  ListaSiniestros,
} from '../ports/claim-repository';
import type { Rol } from '@/domain/types';
import { ESTADOS_BANDEJA, type BandejaPerito } from '@/domain/claim-state/review-flow';

export type ListClaimsDeps = {
  repositorio: ClaimRepository;
};

/**
 * Lista paginada de siniestros.
 * - ASEGURADO: solo los suyos.
 * - PERITO / ADMIN: todos (con filtros opcionales por ruta y estado).
 * La seguridad del filtro por propietario se aplica aquí (dato de sesión,
 * no del cliente) y también en RLS.
 */
export async function listClaims(
  deps: ListClaimsDeps,
  usuarioId: string,
  rol: Rol,
  filtros: Omit<FiltrosSiniestros, 'page' | 'pageSize'> & {
    page?: number;
    pageSize?: number;
    bandeja?: BandejaPerito;
  },
): Promise<ListaSiniestros> {
  const aseguradoId = rol === 'ASEGURADO' ? usuarioId : null;
  return deps.repositorio.listarSiniestros(aseguradoId, {
    ruta: filtros.ruta,
    estado: filtros.estado,
    ...(filtros.bandeja ? { estados: ESTADOS_BANDEJA[filtros.bandeja] } : {}),
    page: filtros.page ?? 1,
    pageSize: filtros.pageSize ?? 20,
  });
}
