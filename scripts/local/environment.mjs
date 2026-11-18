import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

export const root = process.cwd();
export const directory = resolve(root, process.env.AUTODAMAGE_LOCAL_DIR || '.local/servidor');
const configFile = join(directory, 'config.json');
export function configuration() {
  mkdirSync(directory, { recursive: true });
  if (existsSync(configFile)) return JSON.parse(readFileSync(configFile, 'utf8'));
  const config = {
    port: Number(process.env.LOCAL_DATABASE_PORT || 55442),
    user: 'autodamage_owner',
    password: randomBytes(32).toString('base64url'),
    database: 'autodamage',
    data: join(directory, 'postgres'),
    storage: join(directory, 'evidencias'),
    storageSecret: randomBytes(32).toString('hex'),
    bin:
      process.env.POSTGRES_BIN ||
      (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : ''),
  };
  writeFileSync(configFile, JSON.stringify(config, null, 2), { mode: 0o600, flag: 'wx' });
  return config;
}
export function databaseUrl(config, name = config.database) {
  return `postgresql://${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@127.0.0.1:${config.port}/${name}`;
}
export function command(config, name, args, options = {}) {
  const exe = config.bin
    ? join(config.bin, name + (process.platform === 'win32' ? '.exe' : ''))
    : name;
  const result = spawnSync(exe, args, {
    windowsHide: true,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, PGPASSWORD: config.password },
    ...options,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${name} falló. ${result.stderr || result.error?.message || result.stdout || ''}`,
    );
  return result.stdout || '';
}
export function localEnvironment(config) {
  return {
    ...process.env,
    DATA_BACKEND: 'local',
    DATABASE_URL: databaseUrl(config),
    LOCAL_STORAGE_DIR: config.storage,
    LOCAL_STORAGE_SECRET: config.storageSecret,
  };
}
