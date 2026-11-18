// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { solicitarAndroid } from './android-bridge';
afterEach(() => {
  delete window.AutoDamageAndroid;
  vi.useRealTimers();
});
it('entrega solo la respuesta de la petición nativa correspondiente', async () => {
  let id = '';
  window.AutoDamageAndroid = {
    capture: vi.fn((value) => {
      id = value;
    }),
    location: vi.fn(),
  };
  const promise = solicitarAndroid<{ jpeg: string }>('capture');
  window.dispatchEvent(
    new CustomEvent('autodamage-native', { detail: { id: 'otra', data: { jpeg: 'incorrecta' } } }),
  );
  window.dispatchEvent(
    new CustomEvent('autodamage-native', { detail: { id, data: { jpeg: 'correcta' } } }),
  );
  await expect(promise).resolves.toEqual({ jpeg: 'correcta' });
});
it('propaga el rechazo de permiso de Android', async () => {
  window.AutoDamageAndroid = {
    capture: vi.fn(),
    location: (id) => {
      queueMicrotask(() =>
        window.dispatchEvent(
          new CustomEvent('autodamage-native', { detail: { id, error: 'SIN_PERMISO' } }),
        ),
      );
    },
  };
  await expect(solicitarAndroid('location')).rejects.toThrow('SIN_PERMISO');
});
it('libera la petición si el teléfono no responde', async () => {
  vi.useFakeTimers();
  window.AutoDamageAndroid = { capture: vi.fn(), location: vi.fn() };
  const promise = solicitarAndroid('location');
  const result = expect(promise).rejects.toThrow('TIMEOUT');
  await vi.advanceTimersByTimeAsync(15001);
  await result;
});
