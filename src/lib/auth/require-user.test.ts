import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireUser } from './require-user';
const { getClaims, getUser, maybeSingle, eq, select, from, request } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  request: { promise: undefined as Promise<unknown> | undefined },
}));
// Simula el alcance de UNA petición de React; cada beforeEach inicia otra.
vi.mock('react', () => ({
  cache: (fn: () => Promise<unknown>) => () => (request.promise ??= fn()),
}));
vi.mock('@/infrastructure/supabase/server-client', () => ({
  createServerSupabaseClient: async () => ({ auth: { getClaims, getUser }, from }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  request.promise = undefined;
  from.mockReturnValue({ select });
  select.mockReturnValue({ eq });
  eq.mockReturnValue({ maybeSingle });
  getClaims.mockResolvedValue({ data: { claims: { sub: 'u1' } }, error: null });
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  maybeSingle.mockResolvedValue({
    data: { nombre_completo: 'Ana Pérez', rol: 'ASEGURADO' },
    error: null,
  });
});
describe('requireUser', () => {
  it('debería verificar sesión y leer perfil una sola vez en una petición', async () => {
    const [a, b] = await Promise.all([requireUser(), requireUser()]);
    expect(a).toEqual({ usuarioId: 'u1', nombre: 'Ana Pérez', rol: 'ASEGURADO' });
    expect(b).toBe(a);
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledTimes(1);
    expect(getUser).not.toHaveBeenCalled();
  });
  it('debería usar getUser cuando falla getClaims', async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error('claims') });
    getUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null });
    expect((await requireUser()).usuarioId).toBe('u2');
    expect(eq).toHaveBeenCalledWith('id', 'u2');
  });
  it('debería rechazar una sesión ausente', async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
    expect(from).not.toHaveBeenCalled();
  });
  it('debería rechazar el respaldo inválido aunque incluya usuario', async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    getUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: new Error('invalid') });
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it.each(['ADMIN', 'PERITO', 'TALLER', 'ASEGURADO'])(
    'debería devolver el rol validado %s',
    async (rol) => {
      maybeSingle.mockResolvedValue({ data: { nombre_completo: 'Ana', rol }, error: null });
      expect((await requireUser()).rol).toBe(rol);
    },
  );
  it.each([
    { data: null, error: null },
    { data: { nombre_completo: 'Ana', rol: 'SUPERADMIN' }, error: null },
    { data: null, error: new Error('db') },
  ])('debería rechazar perfiles ausentes o inválidos', async (result) => {
    maybeSingle.mockResolvedValue(result);
    await expect(requireUser()).rejects.toMatchObject({ status: 403 });
  });
});
