import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { createReport } from '../ci/report.mjs';
import { Buffer } from 'node:buffer';
const { fetch, FormData, Blob, setTimeout } = globalThis;
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import process from 'node:process';
import console from 'node:console';
import sharp from 'sharp';

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const ci = process.argv.includes('--ci');
const report = createReport(
  'PostgreSQL real',
  process.env.AUTODAMAGE_PG_REPORT_DIR || 'reports/postgres-local',
);
report.begin('Preparación de la base aislada y migraciones');
process.env.AUTODAMAGE_LOCAL_DIR = ci
  ? '.local/ci-postgres/' + randomUUID()
  : '.local/check-' + Date.now();
process.env.LOCAL_DATABASE_PORT = String(await freePort());
const { configuration, localEnvironment, command } = await import('./environment.mjs');
const config = configuration();
const env = {
  ...localEnvironment(config),
  AI_PROVIDER: 'mock',
  MOCK_AI_SCENARIO: 'sin-piezas',
  PORT: String(await freePort()),
  AUTODAMAGE_BUILD_DIR: ci ? process.env.AUTODAMAGE_BUILD_DIR || '.next-ci' : '.next-local-check',
  NEXT_TELEMETRY_DISABLED: '1',
};
const base = 'http://127.0.0.1:' + env.PORT;
function run(args) {
  const child = spawnSync(process.execPath, args, { env, windowsHide: true, stdio: 'inherit' });
  if (child.error || child.status !== 0) throw new Error('Falló la preparación local.');
}
let server;
let stopped = false;
const state = resolve('.local/ci-postgres-state.json');
if (ci) {
  mkdirSync(resolve('.local'), { recursive: true });
  writeFileSync(state, JSON.stringify({ directory: resolve(process.env.AUTODAMAGE_LOCAL_DIR) }));
}
async function stopServer() {
  if (!server?.pid || server.exitCode !== null) return;
  if (process.platform === 'win32')
    spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  else {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill();
    }
  }
  if (process.platform === 'win32') server.kill('SIGKILL');
  if (server.exitCode !== null || server.signalCode !== null) return;
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (server.exitCode === null && server.signalCode === null)
    throw new Error('No se pudo detener el servidor de prueba.');
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    report.fail(new Error('Ejecución interrumpida'));
    void stopServer().finally(() => {
      try {
        command(config, 'pg_ctl', ['-D', config.data, '-m', 'fast', '-w', 'stop'], {
          stdio: 'ignore',
        });
      } catch {
        /* Jenkins reintenta la limpieza en post. */
      }
      report.write();
      process.exit(1);
    });
  });
async function request(path, status, token, data, method) {
  const response = await fetch(base + path, {
    method: method || (data ? 'POST' : 'GET'),
    headers: {
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...(data && !(data instanceof FormData) ? { 'content-type': 'application/json' } : {}),
    },
    body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
  });
  const body = await response.json();
  assert.equal(response.status, status, path + ': ' + JSON.stringify(body));
  return body;
}
try {
  run(['scripts/local/run.mjs', 'setup']);
  report.begin('Creación de cuentas y baremo de prueba');
  run(['node_modules/tsx/dist/cli.mjs', 'scripts/local/seed.ts']);
  report.begin('Notificaciones SQL: estados, taller, fecha y ausencia de duplicados');
  run(['scripts/local/verify-notifications.mjs']);
  report.begin('Arranque de la API con PostgreSQL real');
  if (ci && !existsSync(join(env.AUTODAMAGE_BUILD_DIR, 'BUILD_ID')))
    throw new Error('Ejecuta npm run build:ci antes de las pruebas PostgreSQL de Jenkins.');
  server = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      ci ? 'start' : 'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      env.PORT,
    ],
    { env, windowsHide: true, stdio: 'inherit', detached: process.platform !== 'win32' },
  );
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(base + '/api/vehiculos')).status === 401) {
        ready = true;
        break;
      }
    } catch {
      /* Aún no está listo el servidor. */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(ready, 'El servidor no inició.');
  report.begin('Acceso de los cuatro roles');
  const tokens = {};
  for (const role of ['asegurado', 'perito', 'taller', 'admin']) {
    const login = await request('/api/auth/login', 200, null, {
      email: role + '@demo.com',
      password: process.env.DEMO_PASSWORD || 'Demo123456!',
    });
    assert.equal(typeof login.token, 'string');
    tokens[role] = login.token;
    console.log('Acceso local verificado:', role);
  }
  report.begin('Creación de personal y revocación de su sesión');
  const staff = await request('/api/admin/personal', 201, tokens.admin, {
    tipo: 'PERITO',
    nombre: 'Perito de prueba local',
    email: 'nuevo@local.test',
    numero_licencia: 'LOCAL-TEST-001',
  });
  const staffLogin = await request('/api/auth/login', 200, null, {
    email: 'nuevo@local.test',
    password: staff.passwordTemporal,
  });
  await request(
    '/api/admin/personal/' + staff.usuarioId,
    200,
    tokens.admin,
    { activo: false },
    'PATCH',
  );
  await request('/api/siniestros', 401, staffLogin.token);
  report.begin('Credenciales incorrectas y permisos entre roles');
  await request('/api/auth/login', 401, null, { email: 'admin@demo.com', password: 'incorrecta' });
  await request('/api/vehiculos', 403, tokens.perito);
  await request('/api/ordenes', 403, tokens.asegurado);
  await request('/api/ordenes', 200, tokens.taller);
  report.begin('Registro de vehículo y validación del reporte guiado');
  const vehicle = await request('/api/vehiculos', 201, tokens.asegurado, {
    matricula: 'LOCAL-TEST',
    marca: 'Toyota',
    modelo: 'Corolla',
    numero_poliza: 'LOCAL-TEST-001',
  });
  await request('/api/siniestros', 400, tokens.asegurado, {
    vehiculo_id: vehicle.id,
    descripcion: 'muy feo',
    latitud: -17.39,
    longitud: -66.15,
    fecha_incidente: new Date().toISOString(),
  });
  const claim = await request('/api/siniestros', 201, tokens.asegurado, {
    vehiculo_id: vehicle.id,
    detalles: {
      tipo: 'ESTACIONADO',
      lugar: 'Zona universitaria, Cochabamba',
      relato: 'El vehículo estaba estacionado y esta es una prueba técnica sin siniestro real.',
      danos: 'Evidencia sintética sin daño real.',
      otros_vehiculos: 'NO_SE',
      personas_heridas: 'NO',
    },
    latitud: -17.39,
    longitud: -66.15,
    fecha_incidente: new Date().toISOString(),
  });
  report.begin('Aislamiento de avisos por asegurado y lectura autorizada');
  const ownNotices = await request('/api/notificaciones', 200, tokens.asegurado);
  assert.equal(ownNotices.pendientes, 1);
  assert.equal(ownNotices.notificaciones[0].siniestroId, claim.id);
  const another = await request('/api/auth/registro', 200, null, {
    nombreCompleto: 'Otra persona de prueba',
    email: 'otra@local.test',
    password: 'SoloPruebas123!',
  });
  assert.equal((await request('/api/notificaciones', 200, another.token)).notificaciones.length, 0);
  await request('/api/notificaciones', 404, another.token, { id: ownNotices.notificaciones[0].id });
  await request('/api/notificaciones', 200, tokens.asegurado, {
    id: ownNotices.notificaciones[0].id,
  });
  assert.equal((await request('/api/notificaciones', 200, tokens.asegurado)).pendientes, 0);
  await request('/api/notificaciones', 403, tokens.perito);
  report.begin('Carga de evidencia privada, descarga íntegra y rechazo de firma alterada');
  const jpeg = await sharp({
    create: { width: 640, height: 480, channels: 3, background: '#3498db' },
  })
    .jpeg()
    .toBuffer();
  const form = new FormData();
  form.set('file', new Blob([jpeg], { type: 'image/jpeg' }), 'prueba.jpg');
  form.set('capturada_en', new Date().toISOString());
  form.set('rostros_difuminados', 'true');
  await request('/api/siniestros/' + claim.id + '/imagenes', 201, tokens.asegurado, form);
  const detail = await request('/api/siniestros/' + claim.id, 200, tokens.perito);
  assert.equal(detail.imagenes.length, 1);
  const image = await fetch(base + detail.imagenes[0].url);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
  assert.equal(Buffer.compare(Buffer.from(await image.arrayBuffer()), jpeg), 0);
  assert.equal(
    (
      await fetch(
        base + detail.imagenes[0].url.replace(/firma=[a-f0-9]+/, 'firma=' + '0'.repeat(64)),
      )
    ).status,
    403,
  );
  for (let i = 1; i < 3; i++) {
    const extra = new FormData();
    extra.set('file', new Blob([jpeg], { type: 'image/jpeg' }), 'prueba.jpg');
    extra.set('capturada_en', new Date().toISOString());
    extra.set('orden', String(i));
    extra.set('rostros_difuminados', 'true');
    await request('/api/siniestros/' + claim.id + '/imagenes', 201, tokens.asegurado, extra);
  }
  report.begin('Análisis simulado con persistencia real en PostgreSQL');
  await request('/api/siniestros/' + claim.id + '/analizar', 202, tokens.asegurado, {});
  let analyzed;
  for (let i = 0; i < 30; i++) {
    analyzed = await request('/api/siniestros/' + claim.id, 200, tokens.perito);
    if (analyzed.siniestro.analisisEstado !== 'EN_PROCESO') break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(analyzed.siniestro.analisisEstado, 'COMPLETADO');
  report.begin('Dictamen del perito: rechazo con motivo obligatorio');
  await request('/api/siniestros/' + claim.id + '/dictamen', 400, tokens.perito, {
    dictamen_final: 'RECHAZADO',
  });
  await request('/api/siniestros/' + claim.id + '/dictamen', 200, tokens.perito, {
    dictamen_final: 'RECHAZADO',
    observaciones_perito: 'Evidencia sintética de prueba, sin daño real.',
  });
  const rejected = await request('/api/siniestros/' + claim.id, 200, tokens.asegurado);
  assert.equal(rejected.siniestro.estado, 'RECHAZADO');
  report.begin('Aviso del cambio de estado');
  const changes = await request(
    '/api/notificaciones?despues=' + ownNotices.notificaciones[0].id,
    200,
    tokens.asegurado,
  );
  assert.ok(changes.notificaciones.some((n) => n.titulo.includes('rechazo')));
  report.begin('La app Android rechaza cuentas de otros roles');
  const androidLogin = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'AutoDamageAndroid/1.0' },
    body: JSON.stringify({
      email: 'perito@demo.com',
      password: process.env.DEMO_PASSWORD || 'Demo123456!',
    }),
  });
  assert.equal(androidLogin.status, 403);
  report.begin('Cierre de sesión e invalidación del acceso');
  await request('/api/auth/logout', 200, tokens.asegurado, {}, 'POST');
  await request('/api/vehiculos', 401, tokens.asegurado);
  console.log(
    'VERIFICACIÓN LOCAL CORRECTA: roles, permisos, vehículos, siniestro, foto privada y cierre de sesión.',
  );
} catch (error) {
  report.fail(error);
  console.error('Falló una comprobación PostgreSQL. Consulta el reporte de fases.');
  process.exitCode = 1;
} finally {
  report.begin('Detener el servidor y la base PostgreSQL de prueba');
  try {
    await stopServer();
    if (existsSync(join(config.data, 'postmaster.pid')))
      command(config, 'pg_ctl', ['-D', config.data, '-m', 'fast', '-w', 'stop'], {
        stdio: 'ignore',
      });
    stopped = true;
  } catch (error) {
    report.fail(error);
    process.exitCode = 1;
  }
  report.write();
  if (ci && stopped)
    writeFileSync(
      state,
      JSON.stringify({ directory: resolve(process.env.AUTODAMAGE_LOCAL_DIR), stopped: true }),
    );
}
