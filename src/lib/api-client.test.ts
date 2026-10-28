import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from './api-client';

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serializa el body como JSON y parsea la respuesta', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: '1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await apiFetch('/api/x', {
      method: 'POST',
      body: { a: 1 },
    });

    expect(resultado).toEqual({ id: '1' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('lanza ApiError con el formato estándar del servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: { code: 'SIN_PERMISO', message: 'No tienes permiso' },
        }),
      }),
    );

    const error = (await apiFetch('/api/x').catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('SIN_PERMISO');
    expect(error.status).toBe(403);
  });

  it('devuelve undefined en 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
    expect(await apiFetch('/api/x')).toBeUndefined();
  });

  it('ante error sin cuerpo JSON usa ERROR_INTERNO', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('no json');
        },
      }),
    );
    const error = (await apiFetch('/api/x').catch((e) => e)) as ApiError;
    expect(error.code).toBe('ERROR_INTERNO');
  });

  it('envía FormData sin Content-Type JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.append('file', new Blob(['x']), 'a.jpg');
    await apiFetch('/api/x', { method: 'POST', body: form });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body).toBe(form);
  });
});
