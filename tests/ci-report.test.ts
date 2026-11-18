import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createReport, safeFailure } from '../scripts/ci/report.mjs';
const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});
function directory() {
  const path = mkdtempSync(join(tmpdir(), 'autodamage-report-'));
  directories.push(path);
  return path;
}
it('genera JUnit y HTML con fases aprobadas y una fallida, sin convertir el fallo en éxito', () => {
  const path = directory();
  const report = createReport('Base real', path);
  report.begin('Preparar');
  report.begin('Permisos');
  report.fail(new Error('No autorizado'));
  report.begin('Limpieza');
  report.write();
  const json = JSON.parse(readFileSync(join(path, 'results.json'), 'utf8'));
  expect(json).toMatchObject({ tests: 3, failures: 1 });
  expect(json.cases[1].failure).toBe('No autorizado');
  expect(readFileSync(join(path, 'junit.xml'), 'utf8')).toContain('failures="1"');
  expect(readFileSync(join(path, 'index.html'), 'utf8')).toContain('Fallida');
});
it('escapa HTML/XML y oculta tokens y conexiones privadas en errores', () => {
  const path = directory();
  const report = createReport('API & datos', path);
  report.begin('Entrada <script>');
  report.fail(
    new Error(
      '"token":"token-secreto-123", "passwordTemporal":"password-secreto-456" postgresql://usuario:clave@host/db <script>alert(1)</script>',
    ),
  );
  report.write();
  for (const name of ['index.html', 'junit.xml']) {
    const text = readFileSync(join(path, name), 'utf8');
    expect(text).not.toContain('token-secreto-123');
    expect(text).not.toContain('password-secreto-456');
    expect(text).not.toContain('usuario:clave');
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
  }
});
it('informa fallos de preparación aunque ninguna fase haya comenzado', () => {
  const path = directory();
  const report = createReport('Android', path);
  report.fail(new Error('Falta el SDK'));
  report.write();
  expect(JSON.parse(readFileSync(join(path, 'results.json'), 'utf8'))).toMatchObject({
    tests: 1,
    failures: 1,
  });
  expect(safeFailure(new Error('"password":"clave"'))).not.toContain('clave');
});
