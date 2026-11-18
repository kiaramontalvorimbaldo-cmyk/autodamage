import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';
import console from 'node:console';
import { directory } from './environment.mjs';

const destination = resolve(process.argv[2] || join(directory, 'respaldo-supabase'));
const manifestPath = join(destination, 'manifest.json');
if (existsSync(manifestPath)) throw new Error('Ese respaldo ya existe. Usa una carpeta nueva.');
mkdirSync(destination, { recursive: true });
const manifest = {
  completo: false,
  iniciado: new Date().toISOString(),
  tablas: {},
  archivos: [],
  errores: [],
  cuentas: 'Las contraseñas de Auth requieren exportación administrativa o restablecimiento local.',
};
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
const tables = [
  'usuarios',
  'peritos',
  'talleres',
  'vehiculos',
  'baremo_mock',
  'siniestros',
  'imagenes_siniestro',
  'inspecciones_periciales',
  'evaluacion_detallada_danos',
  'ordenes_trabajo',
  'audit_log',
  'mensajes_siniestro',
];
let images = [];
try {
  for (const table of tables) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db
        .from(table)
        .select('*')
        .order(table === 'mensajes_siniestro' ? 'secuencia' : 'id')
        .range(offset, offset + 499);
      if (error) {
        if (table === 'mensajes_siniestro' && ['PGRST205', '42P01'].includes(error.code)) break;
        manifest.errores.push('No se pudo exportar la tabla ' + table + ' (' + error.code + ')');
        break;
      }
      rows.push(...data);
      if (data.length < 500) break;
    }
    writeFileSync(join(destination, table + '.json'), JSON.stringify(rows), { mode: 0o600 });
    manifest.tablas[table] = rows.length;
    if (table === 'imagenes_siniestro') images = rows;
    console.log(table, rows.length);
  }
  const storage = join(destination, 'evidencias');
  mkdirSync(storage, { recursive: true });
  for (const path of new Set(images.map((image) => image.storage_path))) {
    const file = resolve(storage, path);
    if (relative(storage, file).startsWith('..') || path.includes('\\'))
      throw new Error('Ruta inválida en el respaldo.');
    const { data, error } = await db.storage.from('evidencias').download(path);
    if (error || !data) {
      manifest.errores.push('No se pudo respaldar una evidencia: ' + path);
      continue;
    }
    const bytes = Buffer.from(await data.arrayBuffer());
    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, bytes, { mode: 0o600 });
    manifest.archivos.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  manifest.completo = manifest.errores.length === 0;
  if (!manifest.completo) {
    process.exitCode = 1;
    console.error(manifest.errores.join('\n'));
  }
  console.log(
    manifest.completo ? 'Respaldo completo. Fotografías:' : 'Respaldo parcial. Fotografías:',
    manifest.archivos.length,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudo completar el respaldo.');
  process.exitCode = 1;
} finally {
  manifest.finalizado = new Date().toISOString();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
}
