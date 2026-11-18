import { networkInterfaces } from 'node:os';
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
import pg from 'pg';
import {
  configuration,
  command,
  directory,
  databaseUrl,
  localEnvironment,
} from './environment.mjs';

const action = process.argv[2] || 'setup';
if (!['setup', 'dev', 'start', 'stop', 'status'].includes(action))
  throw new Error('Usa setup, dev, start, stop o status.');
const config = configuration();
let client;
try {
  if (action === 'stop') {
    console.log(command(config, 'pg_ctl', ['-D', config.data, '-m', 'fast', '-w', 'stop']));
  } else {
    if (!existsSync(join(config.data, 'PG_VERSION'))) {
      const passwordFile = join(directory, 'bootstrap-password');
      writeFileSync(passwordFile, config.password, { mode: 0o600 });
      try {
        console.log('Preparando PostgreSQL local…');
        command(config, 'initdb', [
          '-D',
          config.data,
          '-U',
          config.user,
          '-A',
          'scram-sha-256',
          '--pwfile=' + passwordFile,
          '--encoding=UTF8',
          '--no-locale',
          '-c',
          'max_connections=30',
          '-c',
          'shared_buffers=32MB',
        ]);
      } finally {
        unlinkSync(passwordFile);
      }
    }
    try {
      command(config, 'pg_ctl', ['-D', config.data, 'status']);
    } catch {
      command(
        config,
        'pg_ctl',
        [
          '-D',
          config.data,
          '-l',
          join(directory, 'postgres.log'),
          '-o',
          `-h 127.0.0.1 -p ${config.port}`,
          '-w',
          'start',
        ],
        { stdio: 'ignore' },
      );
    }
    client = new pg.Client({
      connectionString: databaseUrl(config, 'postgres'),
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [
      config.database,
    ]);
    if (!exists.rowCount) await client.query('CREATE DATABASE autodamage');
    await client.end();
    client = new pg.Client({
      connectionString: databaseUrl(config),
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    if (action !== 'status') {
      await client.query('BEGIN');
      try {
        await client.query('SELECT pg_advisory_xact_lock(184639)');
        await client.query(
          'CREATE TABLE IF NOT EXISTS local_migrations (nombre TEXT PRIMARY KEY, checksum TEXT NOT NULL, aplicado_en TIMESTAMPTZ NOT NULL DEFAULT now())',
        );
        for (const name of readdirSync('local/migrations')
          .filter((f) => f.endsWith('.sql'))
          .sort()) {
          const sql = readFileSync(join('local/migrations', name), 'utf8');
          const checksum = createHash('sha256').update(sql).digest('hex');
          const previous = await client.query(
            'SELECT checksum FROM local_migrations WHERE nombre=$1',
            [name],
          );
          if (previous.rowCount) {
            if (previous.rows[0].checksum !== checksum)
              throw new Error('La migración aplicada cambió: ' + name);
            continue;
          }
          await client.query(sql);
          await client.query('INSERT INTO local_migrations(nombre,checksum) VALUES($1,$2)', [
            name,
            checksum,
          ]);
          console.log('Migración local aplicada', name);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    const health = await client.query('SELECT count(*)::INT AS usuarios FROM usuarios');
    console.log(
      `PostgreSQL local disponible en 127.0.0.1:${config.port}. Usuarios: ${health.rows[0].usuarios}`,
    );
    await client.end();
    client = undefined;
    if (action === 'dev' || action === 'start') {
      for (const [name, addresses] of Object.entries(networkInterfaces()))
        for (const address of addresses || [])
          if (!address.internal && address.family === 'IPv4')
            console.log(
              'Servidor para Android (' +
                name +
                '): ' +
                address.address +
                ':' +
                (process.env.PORT || '3000'),
            );
      const child = spawn(
        process.execPath,
        ['node_modules/next/dist/bin/next', action, '--hostname', '0.0.0.0'],
        { env: localEnvironment(config), stdio: 'inherit', windowsHide: true },
      );
      for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
      process.exitCode = await new Promise((resolve) => {
        child.once('error', () => resolve(1));
        child.once('exit', (code) => resolve(code ?? 1));
      });
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudo preparar PostgreSQL local.');
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
}
