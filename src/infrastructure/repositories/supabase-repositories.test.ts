import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseClaimRepository } from '@/infrastructure/repositories/supabase-repositories';

const queryState = vi.hoisted(() => ({
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock('@/infrastructure/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ mocked: true })),
}));

vi.mock('@/infrastructure/supabase/tabla', () => ({
  tabla: vi.fn(() => ({
    select: queryState.select.mockReturnValue({
      eq: queryState.eq.mockReturnValue({
        order: queryState.order,
      }),
    }),
  })),
}));

describe('SupabaseClaimRepository', () => {
  beforeEach(() => {
    queryState.select.mockClear();
    queryState.eq.mockClear();
    queryState.order.mockClear();
    queryState.order.mockResolvedValue({
      data: [
        {
          id: 'veh-1',
          asegurado_id: 'user-1',
          matricula: 'ABC-123',
          marca: 'Toyota',
          modelo: 'Corolla',
          numero_poliza: 'POL-123',
        },
      ],
      error: null,
    });
  });

  it('lista vehículos por asegurado ordenando por matrícula, no por created_at inexistente', async () => {
    const repo = new SupabaseClaimRepository();

    const vehiculos = await repo.listarVehiculosPorAsegurado('user-1');

    expect(vehiculos).toHaveLength(1);
    expect(queryState.select).toHaveBeenCalled();
    expect(queryState.eq).toHaveBeenCalledWith('asegurado_id', 'user-1');
    expect(queryState.order).toHaveBeenCalledWith('matricula', { ascending: true });
    expect(queryState.order.mock.calls[0][0]).not.toBe('creado_en');
  });
});
