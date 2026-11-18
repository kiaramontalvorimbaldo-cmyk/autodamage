import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import process from 'node:process';
import { createReport } from './report.mjs';
for (const file of ['index.html', 'junit.xml', 'results.json'])
  rmSync('reports/android/' + file, { force: true });
for (const file of ['AutoDamage-Cliente.apk', 'metadata.json'])
  rmSync('artifacts/android/' + file, { force: true });
const result = spawnSync(process.execPath, ['scripts/local/build-android.mjs'], {
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    AUTODAMAGE_APK_DIR: 'artifacts/android',
    AUTODAMAGE_ANDROID_REPORT_DIR: 'reports/android',
  },
});
if (!existsSync('reports/android/junit.xml')) {
  const report = createReport('Compilación Android', 'reports/android');
  report.fail(result.error || new Error('No se pudo iniciar el generador Android.'));
  report.write();
}
process.exitCode = result.status ?? 1;
