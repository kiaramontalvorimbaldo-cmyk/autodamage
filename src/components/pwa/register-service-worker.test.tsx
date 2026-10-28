import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RegisterServiceWorker } from './register-service-worker';

const descriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
afterEach(() => {
  vi.unstubAllEnvs();
  if (descriptor) Object.defineProperty(navigator, 'serviceWorker', descriptor);
  else Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('registro PWA', () => {
  it('debería registrar solo el worker del mismo origen sin caché de actualización', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const register = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });
    render(<RegisterServiceWorker />);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
  });
  it('debería omitir el registro en desarrollo', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const register = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });
    render(<RegisterServiceWorker />);
    expect(register).not.toHaveBeenCalled();
  });
});
