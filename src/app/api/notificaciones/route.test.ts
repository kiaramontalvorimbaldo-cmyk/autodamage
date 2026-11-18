import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ query: vi.fn(), session: vi.fn() }));
vi.mock('@/lib/session', () => ({ requerirSesion: mocks.session }));
vi.mock('@/infrastructure/local/database', () => ({ localPool: () => ({ query: mocks.query }) }));
import { GET, POST } from './route';
beforeEach(() => {
  vi.stubEnv('DATA_BACKEND', 'local');
  mocks.query.mockReset();
  mocks.session.mockResolvedValue({ sesion: { usuarioId: 'propietario', rol: 'ASEGURADO' } });
});
import { afterEach } from 'vitest';
afterEach(() => vi.unstubAllEnvs());
it('filtra por el propietario y parametriza el cursor', async () => {
  mocks.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ n: 0 }] });
  const result = await GET(new NextRequest('http://localhost/api/notificaciones?despues=42'));
  expect(result.status).toBe(200);
  expect(mocks.query.mock.calls[0][1]).toEqual(['propietario', '42']);
});
it('rechaza un cursor inválido sin consultar la base', async () => {
  expect(
    (await GET(new NextRequest('http://localhost/api/notificaciones?despues=-1'))).status,
  ).toBe(400);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('no permite marcar un aviso ajeno', async () => {
  mocks.query.mockResolvedValue({ rowCount: 0 });
  const response = await POST(
    new NextRequest('http://localhost/api/notificaciones', {
      method: 'POST',
      body: JSON.stringify({ id: '12' }),
    }),
  );
  expect(response.status).toBe(404);
  expect(mocks.query.mock.calls[0][1]).toEqual(['12', 'propietario']);
});
it('comprueba el rol antes de consultar avisos', async () => {
  mocks.session.mockResolvedValue({ respuesta: new Response(null, { status: 403 }) });
  expect((await GET(new NextRequest('http://localhost/api/notificaciones'))).status).toBe(403);
  expect(mocks.query).not.toHaveBeenCalled();
});
