import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const codigo = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
function iniciar(red = vi.fn().mockResolvedValue(new Response('documento privado'))) {
  const listeners = new Map<string, (event: unknown) => void>();
  const claim = vi.fn().mockResolvedValue(undefined);
  const skipWaiting = vi.fn().mockResolvedValue(undefined);
  const caches = new Proxy(
    {},
    {
      get() {
        throw new Error('El worker no debe usar caché');
      },
    },
  );
  runInNewContext(codigo, {
    self: {
      addEventListener: (nombre: string, fn: (event: unknown) => void) => listeners.set(nombre, fn),
      clients: { claim },
      skipWaiting,
    },
    fetch: red,
    Response,
    caches,
  });
  return { listeners, red, claim, skipWaiting };
}

describe('service worker sin almacenamiento privado', () => {
  it('debería enviar la navegación a la red sin guardar el documento', async () => {
    const ctx = iniciar();
    const responder = vi.fn();
    const request = { mode: 'navigate', method: 'GET' };
    ctx.listeners.get('fetch')!({ request, respondWith: responder });
    const respuesta = (await responder.mock.calls[0][0]) as Response;
    expect(await respuesta.text()).toBe('documento privado');
    expect(ctx.red).toHaveBeenCalledWith(request);
  });
  it('debería mostrar una página genérica sin conexión y sin datos del usuario', async () => {
    const ctx = iniciar(vi.fn().mockRejectedValue(new Error('sin conexión')));
    const responder = vi.fn();
    ctx.listeners.get('fetch')!({
      request: { mode: 'navigate', method: 'GET' },
      respondWith: responder,
    });
    const respuesta = (await responder.mock.calls[0][0]) as Response;
    expect(respuesta.status).toBe(503);
    expect(respuesta.headers.get('cache-control')).toBe('no-store');
    expect(await respuesta.text()).toContain('Sin conexión');
  });
  it.each([
    { mode: 'cors', method: 'GET' },
    { mode: 'same-origin', method: 'POST' },
    { mode: 'no-cors', method: 'GET' },
  ])('debería dejar las API y los recursos al navegador: %j', (request) => {
    const ctx = iniciar();
    const responder = vi.fn();
    ctx.listeners.get('fetch')!({ request, respondWith: responder });
    expect(responder).not.toHaveBeenCalled();
    expect(ctx.red).not.toHaveBeenCalled();
  });
});
