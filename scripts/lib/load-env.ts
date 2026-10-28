import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Carga .env.local y .env en process.env (sin sobrescribir valores existentes).
 * Permite que los scripts (`npx tsx scripts/...`) usen las mismas
 * variables que la aplicación sin dependencias adicionales.
 */
export function loadEnvLocal(): void {
  for (const archivo of ['.env.local', '.env']) {
    const ruta = resolve(process.cwd(), archivo);
    if (!existsSync(ruta)) continue;

    const contenido = readFileSync(ruta, 'utf8');
    for (const linea of contenido.split('\n')) {
      const recortada = linea.trim();
      if (!recortada || recortada.startsWith('#')) continue;

      const igual = recortada.indexOf('=');
      if (igual === -1) continue;

      const clave = recortada.slice(0, igual).trim();
      let valor = recortada.slice(igual + 1).trim();
      if (
        (valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))
      ) {
        valor = valor.slice(1, -1);
      }

      if (process.env[clave] === undefined) {
        process.env[clave] = valor;
      }
    }
  }
}

/**
 * Lee una variable de entorno requerida o termina el script con un mensaje claro.
 */
export function requireEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    console.error(`Falta la variable de entorno requerida: ${nombre}`);
    process.exit(1);
  }
  return valor;
}
