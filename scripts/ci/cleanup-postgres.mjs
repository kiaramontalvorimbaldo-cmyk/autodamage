import { readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, join, relative, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
const state = resolve('.local/ci-postgres-state.json');
if (existsSync(state)) {
  const value = JSON.parse(readFileSync(state, 'utf8'));
  const parent = resolve('.local/ci-postgres');
  const directory = resolve(value.directory);
  if (
    relative(parent, directory) !== basename(directory) ||
    !/^[a-f0-9-]{36}$/.test(basename(directory))
  )
    throw new Error('Se rechazó limpiar una carpeta que no corresponde a una base aislada de CI.');
  if (existsSync(join(directory, 'config.json'))) {
    const config = JSON.parse(readFileSync(join(directory, 'config.json'), 'utf8'));
    if (resolve(config.data) !== join(directory, 'postgres'))
      throw new Error('La carpeta de PostgreSQL no corresponde a CI.');
    if (existsSync(join(config.data, 'postmaster.pid'))) {
      const executable = config.bin
        ? join(config.bin, 'pg_ctl' + (process.platform === 'win32' ? '.exe' : ''))
        : 'pg_ctl';
      const stopped = spawnSync(executable, ['-D', config.data, '-m', 'fast', '-w', 'stop'], {
        env: { ...process.env, PGPASSWORD: config.password },
        windowsHide: true,
        stdio: 'ignore',
      });
      if (stopped.error || stopped.status !== 0)
        throw new Error(
          'No se pudo detener PostgreSQL de CI. Se conservó su carpeta para evitar perder datos.',
        );
    }
  }
  // Solo se elimina el UUID validado bajo .local/ci-postgres; nunca .local/servidor.
  rmSync(directory, { recursive: true, force: true });
  rmSync(state);
  console.log('Base PostgreSQL aislada detenida y datos temporales de CI eliminados.');
}
