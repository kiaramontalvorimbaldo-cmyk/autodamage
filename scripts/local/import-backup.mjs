import { readFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import pg from 'pg';
import { configuration, databaseUrl } from './environment.mjs';

const source = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Indica la carpeta del respaldo completo.');
const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
if (!manifest.completo) throw new Error('El respaldo está incompleto. No se importó ningún dato.');
const config = configuration();
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
const identifier = (value) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('Columna inválida en el respaldo.');
  return '"' + value + '"';
};
// Verificar todos los archivos antes de escribir datos. Nunca sobrescribir evidencias distintas.
const files = manifest.archivos.map((file) => {
  const input = resolve(source, 'evidencias', file.path);
  const output = resolve(config.storage, file.path);
  if (
    relative(join(source, 'evidencias'), input).startsWith('..') ||
    relative(config.storage, output).startsWith('..') ||
    file.path.includes('\\')
  )
    throw new Error('Ruta inválida en el respaldo.');
  const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
  if (hash(input) !== file.sha256 || (existsSync(output) && hash(output) !== file.sha256))
    throw new Error('Una evidencia no coincide con el respaldo.');
  return { input, output };
});
const client = new pg.Client({
  connectionString: databaseUrl(config),
  connectionTimeoutMillis: 5000,
});
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(184639)');
  for (const table of tables) {
    const rows = JSON.parse(readFileSync(join(source, table + '.json'), 'utf8'));
    if (!Array.isArray(rows) || rows.length !== manifest.tablas[table])
      throw new Error('El número de filas difiere en ' + table);
    if (!rows.length) continue;
    const { rows: columns } = await client.query(
      "SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
      [table],
    );
    const types = new Map(columns.map((c) => [c.column_name, c.data_type]));
    const count = await client.query(`SELECT count(*)::INT AS n FROM public.${identifier(table)}`);
    if (count.rows[0].n)
      throw new Error(
        'La importación necesita tablas vacías: ' + table + '. Conserva la base existente.',
      );
    for (const row of rows) {
      const keys = Object.keys(row);
      if (keys.some((key) => !types.has(key))) throw new Error('El esquema difiere en ' + table);
      const values = keys.map((key) =>
        ['json', 'jsonb'].includes(types.get(key)) && row[key] != null
          ? JSON.stringify(row[key])
          : row[key],
      );
      await client.query(
        `INSERT INTO public.${identifier(table)} (${keys.map(identifier).join(',')}) OVERRIDING SYSTEM VALUE VALUES (${values.map((_, i) => '$' + (i + 1)).join(',')})`,
        values,
      );
    }
    console.log('Importado', table, rows.length);
  }
  for (const [table, column] of [
    ['baremo_mock', 'id'],
    ['mensajes_siniestro', 'secuencia'],
  ]) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence($1,$2), COALESCE((SELECT max(${identifier(column)}) FROM public.${identifier(table)}),1), EXISTS(SELECT 1 FROM public.${identifier(table)}))`,
      [table, column],
    );
  }
  for (const { input, output } of files) {
    if (!existsSync(output)) {
      mkdirSync(dirname(output), { recursive: true });
      copyFileSync(input, output, 1);
    }
  }
  await client.query('COMMIT');
  console.log(
    'Datos y evidencias importados. Las cuentas necesitan contraseñas locales; no se importan contraseñas de Supabase.',
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(error instanceof Error ? error.message : 'No se pudo importar el respaldo.');
  process.exitCode = 1;
} finally {
  await client.end();
}
