import { it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
const { signUp, withCookies, createClient } = vi.hoisted(() => ({
  signUp: vi.fn(),
  withCookies: vi.fn((response: Response) => {
    response.headers.set('X-Test-Cookie-Propagation', 'ok');
    return response;
  }),
  createClient: vi.fn(),
}));
vi.mock('@/infrastructure/supabase/route-client', () => ({ createAuthRouteClient: createClient }));
beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockReturnValue({ supabase: { auth: { signUp } }, withCookies });
});
function request(data: unknown) {
  return new NextRequest('http://localhost/api/auth/registro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
const valid = {
  nombreCompleto: 'Ana Pérez',
  email: 'ana@example.test',
  password: 'SoloPruebas123!',
};
it('debería ignorar un rol enviado en el registro público', async () => {
  signUp.mockResolvedValue({
    data: { user: { id: 'u1' }, session: { access_token: 'fake' } },
    error: null,
  });
  const response = await POST(
    request({ ...valid, rol: 'ADMIN', options: { data: { rol: 'ADMIN' } } }),
  );
  expect(response.status).toBe(200);
  expect(signUp.mock.calls[0][0].options.data).toEqual({ nombre_completo: 'Ana Pérez' });
  expect(response.headers.get('X-Test-Cookie-Propagation')).toBe('ok');
});
it('debería indicar confirmación si existe usuario pero no sesión', async () => {
  signUp.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null });
  const response = await POST(request(valid));
  expect(response.status).toBe(202);
  expect((await response.json()).error.code).toBe('CONFIRMACION_PENDIENTE');
});
it('debería ocultar el detalle interno de registro', async () => {
  signUp.mockResolvedValue({
    data: { user: null, session: null },
    error: { message: 'secreto del proveedor' },
  });
  const response = await POST(request(valid));
  expect(response.status).toBe(400);
  expect(JSON.stringify(await response.json())).not.toContain('secreto del proveedor');
});
it('debería rechazar datos inválidos antes de consultar Auth', async () => {
  expect((await POST(request({ email: 'incorrecto' }))).status).toBe(400);
  expect(createClient).not.toHaveBeenCalled();
});
it('debería rechazar JSON malformado', async () => {
  const response = await POST(
    new NextRequest('http://localhost/api/auth/registro', { method: 'POST', body: '{' }),
  );
  expect(response.status).toBe(400);
  expect(signUp).not.toHaveBeenCalled();
});
