import { spawn } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { ciEnvironment, publicE2eFiles } from './environment.mjs';

// Ejecutar los CLI con Node evita diferencias de npm.cmd/sh y no usa shell.
const actions = {
  lint: ['node_modules/eslint/bin/eslint.js', '.'],
  typecheck: ['node_modules/typescript/bin/tsc', '--noEmit'],
  unit: [
    'node_modules/vitest/vitest.mjs',
    'run',
    '--configLoader',
    'runner',
    '--coverage',
    '--maxWorkers=2',
    '--testTimeout=20000',
  ],
  build: ['node_modules/next/dist/bin/next', 'build'],
  browsers: ['node_modules/@playwright/test/cli.js', 'install', 'chromium'],
  'browsers-with-deps': [
    'node_modules/@playwright/test/cli.js',
    'install',
    '--with-deps',
    'chromium',
  ],
  e2e: ['node_modules/@playwright/test/cli.js', 'test', ...publicE2eFiles],
};
const action = process.argv[2];
if (!Object.hasOwn(actions, action ?? '')) {
  console.error(
    'Acción de CI no válida. Usa lint, typecheck, unit, build, browsers, browsers-with-deps o e2e.',
  );
  process.exitCode = 1;
} else {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const args = actions[/** @type {keyof typeof actions} */ (action)];
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: ciEnvironment(),
    stdio: 'inherit',
  });
  child.on('error', () => {
    console.error('No se pudo iniciar el comando de CI.');
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    process.exitCode = signal ? 1 : (code ?? 1);
  });
  for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
    process.on(signal, () => child.kill(signal));
  }
}
