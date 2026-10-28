import process from 'node:process';
import console from 'node:console';
const { fetch, AbortSignal } = globalThis;
import { existsSync } from 'node:fs';
for (const file of ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file);
function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error('Falta ' + name);
  return value;
}
async function main() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const tables = [
    'usuarios',
    'vehiculos',
    'peritos',
    'talleres',
    'baremo_mock',
    'siniestros',
    'imagenes_siniestro',
    'inspecciones_periciales',
    'evaluacion_detallada_danos',
    'ordenes_trabajo',
    'audit_log',
  ];
  let failed = false;
  for (const table of tables) {
    try {
      const response = await fetch(url + '/rest/v1/' + table + '?select=*&limit=0', {
        method: 'HEAD',
        headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'count=exact' },
        signal: AbortSignal.timeout(15000),
      });
      console.log(
        table + ': ' + response.status + ' ' + (response.headers.get('content-range') ?? ''),
      );
      if (!response.ok) failed = true;
    } catch {
      console.log(table + ': conexión no disponible');
      failed = true;
    }
  }
  const response = await fetch(url + '/rest/v1/vehiculos?select=creado_en&limit=0', {
    method: 'HEAD',
    headers: { apikey: key, Authorization: 'Bearer ' + key },
    signal: AbortSignal.timeout(15000),
  });
  console.log('Columna vehiculos.creado_en: ' + (response.ok ? 'presente' : 'no verificada'));
  if (!response.ok) failed = true;
  console.log(
    'Solo lectura: no se aplicaron migraciones ni se ejecutaron seeds. No acredita RLS ni historial de migraciones.',
  );
  if (failed) process.exitCode = 1;
}
main().catch(() => {
  console.error('No se pudo completar la verificación.');
  process.exitCode = 1;
});
