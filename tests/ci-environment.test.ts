import { describe, it, expect } from 'vitest';
import { ciEnvironment, publicE2eFiles } from '../scripts/ci/environment.mjs';

describe('aislamiento de la verificación de Jenkins', () => {
  it('debería reemplazar credenciales y destinos heredados por simulaciones locales', () => {
    const base = {
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'privada-no-usar',
      SUPABASE_SERVICE_ROLE_KEY: 'privada-no-usar',
      NEXT_PUBLIC_SUPABASE_URL: 'https://produccion.example',
      SUPABASE_TEST_URL: 'https://dev.example',
      DEV_ASEGURADO_PASSWORD: 'password-no-usar',
      E2E_BASE_URL: 'https://produccion.example',
      E2E_EXTERNAL_SERVER: '1',
    };
    const env = ciEnvironment(base);
    expect(env.AI_PROVIDER).toBe('mock');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321');
    expect(env.E2E_BASE_URL).toBe('http://127.0.0.1:3000');
    expect(env.E2E_EXTERNAL_SERVER).toBe('');
    expect(env.SUPABASE_TEST_URL).toBe('');
    expect(env.DEV_ASEGURADO_PASSWORD).toBe('');
    expect(JSON.stringify(env)).not.toContain('privada-no-usar');
    expect(JSON.stringify(env)).not.toContain('password-no-usar');
    expect(base.AI_PROVIDER).toBe('gemini');
  });
  it('debería conservar herramientas del agente sin reutilizar compilaciones o canales ajenos', () => {
    const env = ciEnvironment({
      PATH: '/bin',
      PLAYWRIGHT_BROWSERS_PATH: '/cache/chromium',
      PLAYWRIGHT_CHANNEL: 'chrome',
      AUTODAMAGE_BUILD_DIR: '.next-personal',
    });
    expect(env.PATH).toBe('/bin');
    expect(env.PLAYWRIGHT_BROWSERS_PATH).toBe('/cache/chromium');
    expect(env.PLAYWRIGHT_CHANNEL).toBe('');
    expect(env.AUTODAMAGE_BUILD_DIR).toBe('.next-ci');
    expect(env.CI).toBe('true');
  });
  it('debería limitar las pruebas de navegador de CI a la suite sin mutaciones de usuarios o casos reales', () => {
    expect(publicE2eFiles.length).toBe(4);
    expect(publicE2eFiles).not.toContain('tests/e2e/siniestro.spec.ts');
    expect(publicE2eFiles).not.toContain('tests/e2e/vehiculos.spec.ts');
  });
});
