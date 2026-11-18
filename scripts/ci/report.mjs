import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function escapeMarkup(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c],
  );
}
export function safeFailure(error) {
  return String(error instanceof Error ? error.message : error)
    .replace(
      /("(?:token|passwordTemporal|password|password_hash)"\s*:\s*)"[^"]*"/gi,
      '$1"[oculto]"',
    )
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[conexión privada]');
}
/** Cada fase se aprueba solo al comenzar la siguiente o finalizar sin errores. */
export function createReport(name, destination) {
  const cases = [];
  let current;
  function end(error) {
    if (!current) return;
    current.seconds = (Date.now() - current.started) / 1000;
    if (error) current.failure = safeFailure(error);
    cases.push(current);
    current = undefined;
  }
  return {
    begin(title) {
      end();
      current = { name: title, started: Date.now() };
    },
    fail(error) {
      if (!current) current = { name: 'Preparación de la ejecución', started: Date.now() };
      end(error);
    },
    write() {
      end();
      mkdirSync(destination, { recursive: true });
      const failures = cases.filter((c) => c.failure).length;
      const total = cases.reduce((sum, c) => sum + c.seconds, 0).toFixed(3);
      const xml = `<?xml version="1.0" encoding="UTF-8"?><testsuites tests="${cases.length}" failures="${failures}"><testsuite name="${escapeMarkup(name)}" tests="${cases.length}" failures="${failures}" errors="0" skipped="0" time="${total}">${cases.map((c) => `<testcase classname="${escapeMarkup(name)}" name="${escapeMarkup(c.name)}" time="${c.seconds.toFixed(3)}">${c.failure ? `<failure message="${escapeMarkup(c.failure)}">${escapeMarkup(c.failure)}</failure>` : ''}</testcase>`).join('')}</testsuite></testsuites>`;
      writeFileSync(join(destination, 'junit.xml'), xml);
      writeFileSync(
        join(destination, 'results.json'),
        JSON.stringify(
          {
            name,
            tests: cases.length,
            failures,
            seconds: Number(total),
            cases: cases.map(({ name, seconds, failure }) => ({
              name,
              seconds,
              ...(failure ? { failure } : {}),
            })),
          },
          null,
          2,
        ),
      );
      // HTML autónomo sin JavaScript ni recursos externos: funciona con HTML Publisher.
      writeFileSync(
        join(destination, 'index.html'),
        `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeMarkup(name)}</title><style>body{font:16px system-ui,sans-serif;max-width:1000px;margin:40px auto;padding:0 20px;color:#123}table{width:100%;border-collapse:collapse}th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}pre{white-space:pre-wrap;overflow-wrap:anywhere}.pass{color:#067647}.fail{color:#b42318}</style><h1>${escapeMarkup(name)}</h1><p>${cases.length} fases · ${failures} fallidas · ${total} segundos</p><p>Solo se muestran fases ejecutadas. Un fallo interrumpe las comprobaciones dependientes. No acredita pruebas de cámara ni de interfaz en un teléfono.</p><table><thead><tr><th>Comprobación</th><th>Resultado</th><th>Segundos</th></tr></thead><tbody>${cases.map((c) => `<tr><td>${escapeMarkup(c.name)}${c.failure ? `<pre>${escapeMarkup(c.failure)}</pre>` : ''}</td><td class="${c.failure ? 'fail' : 'pass'}">${c.failure ? 'Fallida' : 'Aprobada'}</td><td>${c.seconds.toFixed(3)}</td></tr>`).join('')}</tbody></table></html>`,
      );
    },
  };
}
