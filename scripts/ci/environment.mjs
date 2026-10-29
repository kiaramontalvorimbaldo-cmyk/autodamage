import process from 'node:process';
/** Entorno aislado de verificación: no requiere credenciales reales. */
/**
 * @param {Record<string, string | undefined>} base
 * @returns {Record<string, string | undefined>}
 */
export function ciEnvironment(base = process.env) {
  const env = { ...base };
  for (const name of Object.keys(env)) {
    if (/^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|GEMINI_|DEV_|E2E_)/i.test(name)) env[name] = '';
  }
  return {
    ...env,
    CI: 'true',
    HUSKY: '0',
    NEXT_TELEMETRY_DISABLED: '1',
    AI_PROVIDER: 'mock',
    MOCK_AI_SCENARIO: 'leve-faro',
    GEMINI_MODEL: 'ci-mock-model',
    GEMINI_API_KEY: 'ci-placeholder-not-a-real-key',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'ci-placeholder-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'ci-placeholder-service-key',
    SUPABASE_TEST_URL: '',
    SUPABASE_TEST_SERVICE_KEY: '',
    DEV_ASEGURADO_EMAIL: 'asegurado@ci.example',
    DEV_ASEGURADO_PASSWORD: '',
    DEV_PERITO_EMAIL: 'perito@ci.example',
    DEV_ADMIN_EMAIL: 'admin@ci.example',
    DEV_TALLER_2_EMAIL: 'taller2@ci.example',
    DEV_TALLER_1_EMAIL: 'taller1@ci.example',
    DEV_TALLER_1_PASSWORD: '',
    E2E_NUEVO_USUARIO_PASSWORD: '',
    E2E_EXTERNAL_SERVER: '',
    E2E_BASE_URL: 'http://127.0.0.1:3000',
    PLAYWRIGHT_CHANNEL: '',
    PLAYWRIGHT_HTML_OPEN: 'never',
    PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT: base.PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT || '120000',
    DAILY_AI_QUOTA_LIMIT: '200',
    AI_MAX_RPM: '10',
    AUTODAMAGE_BUILD_DIR: '.next-ci',
    AUTODAMAGE_SERIAL_BUILD: '1',
  };
}

export const publicE2eFiles = Object.freeze([
  'tests/e2e/acceso-publico.spec.ts',
  'tests/e2e/login.spec.ts',
  'tests/e2e/sprint1-seguridad.spec.ts',
  'tests/e2e/pwa.spec.ts',
]);
