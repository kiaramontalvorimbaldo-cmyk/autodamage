import { beforeEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { refreshSession } from './refresh-session';
type CookieOptions = { path?: string; httpOnly?: boolean };
const state = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  from: vi.fn(),
  cookies: undefined as
    undefined | { setAll: (v: { name: string; value: string; options: CookieOptions }[]) => void },
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _u: string,
    _k: string,
    options: { cookies: NonNullable<typeof state.cookies> },
  ) => {
    state.cookies = options.cookies;
    return { auth: { getClaims: state.getClaims, getUser: state.getUser }, from: state.from };
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.getClaims.mockResolvedValue({ data: null, error: null });
  state.getUser.mockResolvedValue({ data: { user: null }, error: null });
  state.from.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: state.maybeSingle }) }),
  });
});
it('debería proteger admin cuando no existe sesión', async () => {
  const response = await refreshSession(new NextRequest('http://localhost/admin'));
  expect(response.headers.get('location')).toBe('http://localhost/login');
});
it('debería dejar accesible el registro público', async () => {
  expect((await refreshSession(new NextRequest('http://localhost/registro'))).status).toBe(200);
});
it('debería enviar al administrador autenticado a admin', async () => {
  state.getClaims.mockResolvedValue({ data: { claims: { sub: 'u1' } }, error: null });
  state.maybeSingle.mockResolvedValue({ data: { rol: 'ADMIN' } });
  expect(
    (await refreshSession(new NextRequest('http://localhost/login'))).headers.get('location'),
  ).toBe('http://localhost/admin');
});
it('debería dejar la lectura del rol protegido al layout', async () => {
  state.getClaims.mockResolvedValue({ data: { claims: { sub: 'u1' } }, error: null });
  expect((await refreshSession(new NextRequest('http://localhost/perito'))).status).toBe(200);
  expect(state.from).not.toHaveBeenCalled();
});
it('debería respaldar getClaims con getUser', async () => {
  state.getClaims.mockResolvedValue({ data: null, error: new Error('claims') });
  state.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  expect((await refreshSession(new NextRequest('http://localhost/asegurado'))).status).toBe(200);
});
it('debería conservar cookies renovadas al redirigir', async () => {
  state.getClaims.mockImplementation(async () => {
    state.cookies?.setAll([
      { name: 'session', value: 'renewed', options: { path: '/', httpOnly: true } },
    ]);
    return { data: { claims: { sub: 'u1' } }, error: null };
  });
  state.maybeSingle.mockResolvedValue({ data: { rol: 'ADMIN' } });
  const response = await refreshSession(new NextRequest('http://localhost/login'));
  expect(response.cookies.get('session')?.value).toBe('renewed');
  expect(response.headers.get('location')).toBe('http://localhost/admin');
});
it('debería denegar navegación protegida ante errores inesperados', async () => {
  state.getClaims.mockRejectedValue(new Error('unexpected'));
  expect(
    (await refreshSession(new NextRequest('http://localhost/admin/personal'))).headers.get(
      'location',
    ),
  ).toBe('http://localhost/login');
});
