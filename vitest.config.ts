import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    reporters: ['default', 'junit'],
    outputFile: { junit: 'junit-results/vitest.xml' },
    environment: 'node',
    environmentMatchGlobs: [
      ['src/components/**', 'jsdom'],
      ['src/hooks/**', 'jsdom'],
      ['src/lib/compressImage.test.ts', 'jsdom'],
    ],
    setupFiles: ['./tests/setup.ts'],
    // Variables de entorno de prueba (getEnv() valida al arrancar).
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      GEMINI_API_KEY: 'test-gemini-key',
      GEMINI_MODEL: 'gemini-test-model',
      AI_PROVIDER: 'mock',
      DAILY_AI_QUOTA_LIMIT: '200',
      AI_MAX_RPM: '10',
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/domain/**', 'src/lib/**', 'src/application/**'],
      thresholds: {
        global: { lines: 70, functions: 70, branches: 70, statements: 70 },
        'src/domain/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
