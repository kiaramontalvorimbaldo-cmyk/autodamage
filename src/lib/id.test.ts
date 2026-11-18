import { afterEach, expect, it, vi } from 'vitest';
import { crearId } from './id';
afterEach(() => vi.unstubAllGlobals());
it('genera un UUID v4 usando aleatoriedad segura cuando randomUUID no existe en HTTP', () => {
  const secure = vi.fn((bytes: Uint8Array) => {
    bytes.fill(255);
    return bytes;
  });
  vi.stubGlobal('crypto', { getRandomValues: secure });
  expect(crearId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  expect(secure).toHaveBeenCalledOnce();
});
it('conserva el generador seguro del navegador si está disponible', () => {
  vi.stubGlobal('crypto', { randomUUID: () => 'id-seguro' });
  expect(crearId()).toBe('id-seguro');
});
