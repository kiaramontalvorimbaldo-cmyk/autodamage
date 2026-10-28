import { describe, expect, it } from 'vitest';
import { securityHeaders, contentSecurityPolicy } from './security-headers';

describe('security-headers', () => {
  it('debería permitir evidencias de Supabase sin permitir cualquier servidor de imágenes', () => {
    const img = contentSecurityPolicy('prueba', false)
      .split(';')
      .find((d) => d.trim().startsWith('img-src'))!;
    expect(img).toContain('https://*.supabase.co');
    expect(img).not.toMatch(/(?:^|\s)\*(?:\s|$)/);
  });
  it('incluye las cabeceras esperadas', () => {
    const claves = securityHeaders.map((h) => h.key);
    expect(claves).toContain('Content-Security-Policy');
    expect(claves).toContain('X-Content-Type-Options');
    expect(claves).toContain('Referrer-Policy');
    expect(claves).toContain('Permissions-Policy');
  });

  it('Permissions-Policy limita cámara y geolocalización al propio origen', () => {
    const pp = securityHeaders.find((h) => h.key === 'Permissions-Policy')?.value;
    expect(pp).toContain('camera=(self)');
    expect(pp).toContain('geolocation=(self)');
    expect(pp).toContain('microphone=()');
  });

  it('CSP restringe default-src y conecta solo con orígenes conocidos', () => {
    const csp = securityHeaders.find((h) => h.key === 'Content-Security-Policy')?.value;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('https://*.supabase.co');
    expect(csp).toContain('worker-src');
  });
});

it('debería autorizar solo el nonce de la petición en producción', () => {
  const policy = contentSecurityPolicy('nonce-de-prueba', false);
  expect(policy).toContain("'nonce-nonce-de-prueba'");
  expect(policy.split(';').find((d) => d.trim().startsWith('script-src'))).not.toMatch(
    /unsafe-inline|unsafe-eval/,
  );
});
it('debería permitir las herramientas locales solo en desarrollo', () =>
  expect(contentSecurityPolicy(undefined, true)).toContain("'unsafe-eval'"));
