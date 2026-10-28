import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseClaimRepository } from './supabase-repositories';
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock('@/infrastructure/supabase/admin-client', () => ({ getAdminClient: () => ({}) }));
vi.mock('@/infrastructure/supabase/tabla', () => ({
  tabla: (_client: unknown, name: string) =>
    name === 'peritos'
      ? { select: () => ({ eq: () => ({ maybeSingle: mocks.lookup }) }) }
      : { update: mocks.update },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ error: null });
});
const cambios = {
  peritoId: 'cuenta-perito',
  dictamenFinal: 'RECHAZADO' as const,
  observacionesPerito: 'Sin evidencia válida',
  kilometraje: null,
  costoTotalEstimado: 0,
};
describe('regresión identificador de perito al rechazar', () => {
  it('debería escribir la clave del perito, conservando la cuenta como entrada', async () => {
    mocks.lookup.mockResolvedValue({
      data: { id: 'registro-perito', estado: 'ACTIVO' },
      error: null,
    });
    await new SupabaseClaimRepository().actualizarInspeccionDictamen('inspeccion', cambios);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ perito_id: 'registro-perito', dictamen_final: 'RECHAZADO' }),
    );
  });
  it('debería impedir el dictamen de un perfil inactivo sin escribirlo', async () => {
    mocks.lookup.mockResolvedValue({
      data: { id: 'registro-perito', estado: 'INACTIVO' },
      error: null,
    });
    await expect(
      new SupabaseClaimRepository().actualizarInspeccionDictamen('inspeccion', cambios),
    ).rejects.toMatchObject({ code: 'SIN_PERMISO' });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
