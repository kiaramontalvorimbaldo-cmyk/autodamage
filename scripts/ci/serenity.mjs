import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createPortProbe } from 'node:net';
import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { ciEnvironment } from './environment.mjs';
import { findMaven, createDependencyHandler } from './serenity-support.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const env = ciEnvironment();
const development = process.argv.slice(2).includes('--dev');
let server;
let mavenProcess;
let cancelled = false;
const fixture = createServer();

/** @param {import('node:http').Server | import('node:net').Server} socket */
async function listen(socket) {
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const address = socket.address();
  if (!address || typeof address === 'string')
    throw new Error('No se pudo asignar un puerto local');
  return address.port;
}

/** @param {string} executable @param {string[]} args */
function maven(executable, args) {
  return new Promise((resolve, reject) => {
    const windows = process.platform === 'win32';
    // PowerShell recibe ruta y argumentos como datos; no se concatena código de shell.
    const command = windows
      ? join(env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe')
      : executable;
    const commandArgs = windows
      ? [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          '$taskMavenArgs = @($env:AUTODAMAGE_MAVEN_ARGS | ConvertFrom-Json); & $env:AUTODAMAGE_MAVEN_EXECUTABLE @taskMavenArgs; exit $LASTEXITCODE',
        ]
      : args;
    mavenProcess = spawn(command, commandArgs, {
      cwd: root,
      env: {
        ...env,
        AUTODAMAGE_MAVEN_EXECUTABLE: executable,
        AUTODAMAGE_MAVEN_ARGS: JSON.stringify(args),
      },
      stdio: 'inherit',
      windowsHide: true,
    });
    mavenProcess.once('error', reject);
    mavenProcess.once('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.on(signal, () => {
    cancelled = true;
    server?.kill();
    mavenProcess?.kill();
  });
}

try {
  const executable = findMaven(env);
  if (process.argv.slice(2).some((arg) => arg !== '--dev'))
    throw new Error('La única opción local admitida es --dev.');
  if (!development && !existsSync(join(root, '.next-ci', 'BUILD_ID')))
    throw new Error('Ejecuta npm run build:ci antes de las pruebas Serenity.');
  const dependency = createDependencyHandler();
  fixture.on('request', dependency.handler);
  const fixturePort = await listen(fixture);
  const probe = createPortProbe();
  const port = await listen(probe);
  await new Promise((resolve, reject) => probe.close((e) => (e ? reject(e) : resolve())));
  const baseUrl = `http://127.0.0.1:${port}`;
  const fixtureUrl = `http://127.0.0.1:${fixturePort}`;
  env.NEXT_PUBLIC_SUPABASE_URL = fixtureUrl;
  env.AUTODAMAGE_SERENITY_BASE_URL = baseUrl;
  let serverExited = false;
  server = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      development ? 'dev' : 'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    { cwd: root, env, stdio: 'inherit', windowsHide: true },
  );
  server.once('exit', () => {
    serverExited = true;
  });
  server.once('error', () => {
    serverExited = true;
  });
  let ready = false;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline && !serverExited && !cancelled) {
    try {
      const response = await globalThis.fetch(`${baseUrl}/api/health`, {
        signal: globalThis.AbortSignal.timeout(2000),
        redirect: 'error',
      });
      if (response.status === 200 && (await response.json()).db === 'ok') {
        ready = true;
        break;
      }
    } catch {
      /* Esperar a que arranque el servidor propio. */
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 500));
  }
  if (!ready)
    throw new Error(
      'La aplicación de prueba no arrancó con su dependencia local; no se ejecutarán pruebas contra otro servidor.',
    );
  console.log(
    'Serenity API: aplicación real y dependencia simulada en puertos locales exclusivos.',
  );
  const code = await maven(executable, [
    '--batch-mode',
    '--no-transfer-progress',
    '-f',
    'serenity-tests/pom.xml',
    `-Dautodamage.baseUrl=${baseUrl}`,
    `-Dautodamage.fixtureUrl=${fixtureUrl}`,
    'clean',
    'verify',
  ]);
  process.exitCode = cancelled ? 1 : /** @type {number} */ (code);
  if (dependency.unexpected.length) {
    console.error(
      'La aplicación intentó operaciones no previstas contra la dependencia simulada:',
      dependency.unexpected,
    );
    process.exitCode = 1;
  }
  if (!existsSync(join(root, 'serenity-tests/target/site/serenity/index.html'))) {
    console.error('No se generó el reporte Serenity. Revisa la salida de Maven.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falló la preparación de Serenity.');
  process.exitCode = 1;
} finally {
  server?.kill();
  fixture.closeAllConnections();
  if (fixture.listening) await new Promise((resolve) => fixture.close(resolve));
}
