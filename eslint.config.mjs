import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const eslintConfig = tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.next-design/**',
      '.next-followup/**',
      '.next-*/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'junit-results/**',
      'public/mediapipe/**',
      'public/icons/**',
      'next-env.d.ts',
    ],
  },
  { plugins: { '@next/next': nextPlugin } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-sync-scripts': 'error',
      '@next/next/google-font-display': 'error',
      '@next/next/google-font-preconnect': 'error',
      '@next/next/inline-script-id': 'error',
      '@next/next/next-script-for-ga': 'error',
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'domain/ no puede importar React' },
            { name: 'next', message: 'domain/ no puede importar Next' },
          ],
          patterns: [
            { group: ['@/application/*'], message: 'domain/ no puede importar application/' },
            { group: ['@/infrastructure/*'], message: 'domain/ no puede importar infrastructure/' },
            { group: ['@/app/*'], message: 'domain/ no puede importar app/' },
            { group: ['@/components/*'], message: 'domain/ no puede importar components/' },
            { group: ['@/hooks/*'], message: 'domain/ no puede importar hooks/' },
            { group: ['@supabase/*'], message: 'domain/ no puede importar Supabase' },
            { group: ['@google/genai'], message: 'domain/ no puede importar Gemini' },
            { group: ['next/*'], message: 'domain/ no puede importar Next' },
            { group: ['sharp'], message: 'domain/ no puede importar sharp' },
            { group: ['exifr'], message: 'domain/ no puede importar exifr' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/app/*'], message: 'application/ no puede importar app/' },
            { group: ['@/components/*'], message: 'application/ no puede importar components/' },
            {
              group: ['@/infrastructure/*'],
              message: 'application/ no puede importar infrastructure/ (usa puertos)',
            },
            {
              group: ['@supabase/*'],
              message: 'application/ no puede importar Supabase directamente',
            },
            {
              group: ['@google/genai'],
              message: 'application/ no puede importar Gemini directamente',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/app/*'], message: 'infrastructure/ no puede importar app/' },
            { group: ['@/components/*'], message: 'infrastructure/ no puede importar components/' },
          ],
        },
      ],
    },
  },
  {
    // Las pruebas actúan como composition root:
    // pueden importar infraestructura para inyectar
    // implementaciones en memoria.
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);

export default eslintConfig;
