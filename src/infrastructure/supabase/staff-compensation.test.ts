import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseStaffRepository } from './supabase-staff-repository';
const state = vi.hoisted(() => ({
  writes: [] as Record<string, unknown>[],
  fallarRestauracion: false,
  ban: vi.fn(),
}));
vi.mock('@/infrastructure/supabase/admin-client', () => ({
  getAdminClient: () => ({ auth: { admin: { updateUserById: state.ban } } }),
}));
vi.mock('@/infrastructure/supabase/tabla', () => ({
  tabla: (_client: unknown, table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: table === 'usuarios' ? { rol: 'TALLER' } : { id: 't', activo: true },
          error: null,
        }),
      }),
    }),
    update: (patch: Record<string, unknown>) => ({
      eq: async () => {
        state.writes.push(patch);
        return {
          error: state.fallarRestauracion && state.writes.length === 2 ? { code: 'fallo' } : null,
        };
      },
    }),
  }),
}));
beforeEach(() => {
  state.writes = [];
  state.fallarRestauracion = false;
  state.ban.mockReset();
  state.ban.mockResolvedValue({ error: { message: 'fallo de Auth' } });
});
describe('compensación de estado del personal', () => {
  it('debería restaurar el perfil si no se confirma el cambio de Auth', async () => {
    await expect(
      new SupabaseStaffRepository().cambiarActivoPersonal('u', false),
    ).rejects.toMatchObject({ code: 'ERROR_ACTUALIZAR_PERSONAL' });
    expect(state.writes).toEqual([{ activo: false }, { activo: true }]);
  });
  it('debería avisar de reconciliación pendiente si la compensación también falla', async () => {
    state.fallarRestauracion = true;
    await expect(
      new SupabaseStaffRepository().cambiarActivoPersonal('u', false),
    ).rejects.toMatchObject({ code: 'PERSONAL_RECONCILIACION_PENDIENTE' });
  });
});
