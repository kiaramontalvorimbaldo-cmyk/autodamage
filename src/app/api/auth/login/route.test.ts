import { it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
const state = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  maybeSingle: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock('@/infrastructure/supabase/route-client', () => ({
  createAuthRouteClient: state.createClient,
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.signIn.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  state.signOut.mockResolvedValue({ error: null });
  state.createClient.mockReturnValue({
    supabase: {
      auth: { signInWithPassword: state.signIn, signOut: state.signOut },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: state.maybeSingle }) }) }),
    },
    withCookies: (response: Response) => {
      response.headers.set('X-Test-Cookie-Propagation', 'ok');
      return response;
    },
  });
});
function request(body: unknown = { email: 'ana@example.test', password: 'SoloPruebas123!' }) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
it.each([
  ['ASEGURADO', '/asegurado'],
  ['PERITO', '/perito'],
  ['TALLER', '/taller'],
  ['ADMIN', '/admin'],
])('debería enviar %s al destino del rol guardado', async (rol, destino) => {
  state.maybeSingle.mockResolvedValue({ data: { rol }, error: null });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect((await response.json()).destino).toBe(destino);
  expect(response.headers.get('X-Test-Cookie-Propagation')).toBe('ok');
});
it('debería ignorar un destino o rol enviado por el navegador', async () => {
  state.maybeSingle.mockResolvedValue({ data: { rol: 'ASEGURADO' }, error: null });
  const response = await POST(
    request({
      email: 'ana@example.test',
      password: 'SoloPruebas123!',
      rol: 'ADMIN',
      destino: '/admin',
    }),
  );
  expect((await response.json()).destino).toBe('/asegurado');
});
it.each([
  { data: null, error: null },
  { data: { rol: 'DESCONOCIDO' }, error: null },
  { data: null, error: { message: 'fallo' } },
])('debería cerrar la sesión si el perfil no está autorizado', async (profile) => {
  state.maybeSingle.mockResolvedValue(profile);
  const response = await POST(request());
  expect(response.status).toBe(403);
  expect(state.signOut).toHaveBeenCalledOnce();
});
it('debería devolver 401 sin filtrar el error del proveedor', async () => {
  state.signIn.mockResolvedValue({
    data: { user: null },
    error: { message: 'secreto del proveedor' },
  });
  const response = await POST(request());
  expect(response.status).toBe(401);
  expect(JSON.stringify(await response.json())).not.toContain('secreto del proveedor');
});
it('debería rechazar datos y JSON inválidos antes de crear un cliente', async () => {
  expect((await POST(request({}))).status).toBe(400);
  expect(
    (await POST(new NextRequest('http://localhost/api/auth/login', { method: 'POST', body: '{' })))
      .status,
  ).toBe(400);
  expect(state.createClient).not.toHaveBeenCalled();
});
