import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import process from 'node:process';

/** @param {Record<string, string | undefined>} env */
export function findMaven(env = process.env) {
  const windows = process.platform === 'win32';
  const name = windows ? 'mvn.cmd' : 'mvn';
  const homes = [env.MAVEN_HOME, env.M2_HOME].filter(Boolean);
  const candidates = [
    ...homes.map((home) => join(/** @type {string} */ (home), 'bin', name)),
    ...(env.PATH || env.Path || '')
      .split(delimiter)
      .filter(Boolean)
      .map((p) => join(p, name)),
  ];
  const executable = candidates.find((p) => existsSync(p));
  if (!executable)
    throw new Error('No se encontró Maven. Configura MAVEN_HOME o añade Maven al PATH.');
  // La ejecución de un .cmd requiere shell en Windows: no aceptar metacaracteres.
  if (windows && /[\r\n"&|<>^%!]/.test(executable))
    throw new Error('La ruta de Maven contiene caracteres no admitidos.');
  return executable;
}

/** Dependencia de datos en memoria, no una implementación de Supabase real. */
export function createDependencyHandler() {
  let available = true;
  const unexpected = [];
  /** @param {import('node:http').IncomingMessage} request @param {import('node:http').ServerResponse} response */
  function handler(request, response) {
    request.resume();
    response.setHeader('Content-Type', 'application/json');
    if (
      request.method === 'POST' &&
      ['/modo/disponible', '/modo/indisponible'].includes(request.url || '')
    ) {
      available = request.url === '/modo/disponible';
      response.writeHead(204).end();
    } else if (request.method === 'POST' && request.url === '/rest/v1/rpc/ping') {
      response
        .writeHead(available ? 200 : 503)
        .end(JSON.stringify(available ? 1 : { message: 'Dependencia de prueba indisponible' }));
    } else if (request.method === 'POST' && request.url?.startsWith('/auth/v1/token?')) {
      response
        .writeHead(400)
        .end(JSON.stringify({ code: 'invalid_credentials', msg: 'Invalid login credentials' }));
    } else {
      unexpected.push(`${request.method} ${request.url}`);
      response
        .writeHead(500)
        .end(JSON.stringify({ message: 'Operación no permitida en la dependencia de pruebas' }));
    }
  }
  return { handler, unexpected };
}
