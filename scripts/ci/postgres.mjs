import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import process from 'node:process';
import { ciEnvironment } from './environment.mjs';
import { createReport } from './report.mjs';
for (const file of ['index.html', 'junit.xml', 'results.json'])
  rmSync('reports/postgres/' + file, { force: true });
const env = {
  ...ciEnvironment(),
  DEMO_PASSWORD: 'SoloCI123456!',
  AUTODAMAGE_PG_REPORT_DIR: 'reports/postgres',
};
const result = spawnSync(process.execPath, ['scripts/local/verify.mjs', '--ci'], {
  env,
  stdio: 'inherit',
  windowsHide: true,
});
if (!existsSync('reports/postgres/junit.xml')) {
  const report = createReport('PostgreSQL real', 'reports/postgres');
  report.fail(
    result.error ||
      new Error(
        'La verificación no pudo iniciarse. Revisa Node, PostgreSQL y los permisos del agente.',
      ),
  );
  report.write();
}
process.exitCode = result.status ?? 1;
