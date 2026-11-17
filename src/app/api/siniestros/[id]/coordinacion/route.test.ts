import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/session', () => ({ requerirSesion: mocks.auth }));
vi.mock('@/infrastructure/supabase/route-client', () => ({
  createAuthRouteClient: () => ({ supabase: { rpc: mocks.rpc }, withCookies: (r: Response) => r }),
}));
import { GET, POST } from './route';
const id = '00000000-0000-4000-8000-000000000001';
const messageId = '00000000-0000-4000-8000-000000000002';
const params = { params: Promise.resolve({ id }) };
const request = (body: unknown) =>
  new NextRequest(`http://localhost/api/siniestros/${id}/coordinacion`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ sesion: { usuarioId: 'usuario', rol: 'TALLER' } });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});

it('bloquea peticiones anónimas antes de consultar el chat', async () => {
  mocks.auth.mockResolvedValue({ respuesta: Response.json({}, { status: 401 }) });
  expect((await GET(new NextRequest('http://localhost'), params)).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('envía el identificador del caso y del intento sin aceptar un autor del navegador', async () => {
  const result = await POST(
    request({
      tipo: 'mensaje',
      id: messageId,
      contenido: '  Encontré una pieza rota  ',
      autor_id: 'ajeno',
    }),
    params,
  );
  expect(result.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith('enviar_mensaje_siniestro', {
    p_siniestro: id,
    p_id: messageId,
    p_contenido: 'Encontré una pieza rota',
  });
});

it('rechaza un mensaje vacío y una fecha inexistente', async () => {
  expect(
    (await POST(request({ tipo: 'mensaje', id: messageId, contenido: '  ' }), params)).status,
  ).toBe(400);
  expect(
    (await POST(request({ tipo: 'entrega', fecha: '2026-02-30', anterior: null }), params)).status,
  ).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('rechaza cursores inválidos sin consultar datos', async () => {
  for (const antes of ['abc', '-1', '9999999999999999999']) {
    const resultado = await GET(
      new NextRequest(`http://localhost/api/siniestros/${id}/coordinacion?antes=${antes}`),
      params,
    );
    expect(resultado.status).toBe(400);
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('solo el taller puede cambiar la fecha', async () => {
  mocks.auth.mockResolvedValue({ sesion: { usuarioId: 'perito', rol: 'PERITO' } });
  expect(
    (await POST(request({ tipo: 'entrega', fecha: '2026-12-01', anterior: null }), params)).status,
  ).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('respeta el rechazo de PostgreSQL para casos ajenos', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: 'SIN_PERMISO' } });
  expect(
    (await POST(request({ tipo: 'mensaje', id: messageId, contenido: 'Hola' }), params)).status,
  ).toBe(403);
});

it('devuelve conflicto si otra sesión ya modificó la entrega', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: 'FECHA_CAMBIADA' } });
  expect(
    (await POST(request({ tipo: 'entrega', fecha: '2026-12-01', anterior: null }), params)).status,
  ).toBe(409);
});

it('pagina los mensajes conservando el orden y evita caché compartida', async () => {
  mocks.rpc.mockResolvedValue({
    error: null,
    data: {
      fechaEntrega: '2026-12-01',
      mensajes: Array.from({ length: 101 }, (_, i) => ({
        id: messageId,
        secuencia: String(i + 1),
        nombre: 'Taller',
        rol: 'TALLER',
        contenido: 'Mensaje',
        fecha: '2026-11-17T12:00:00Z',
      })),
    },
  });
  const result = await GET(
    new NextRequest(`http://localhost/api/siniestros/${id}/coordinacion?antes=200`),
    params,
  );
  const body = await result.json();
  expect(body.mensajes).toHaveLength(100);
  expect(body.antes).toBe('2');
  expect(mocks.rpc).toHaveBeenCalledWith('consultar_coordinacion', {
    p_siniestro: id,
    p_antes: '200',
  });
  expect(result.headers.get('Cache-Control')).toContain('no-store');
});
