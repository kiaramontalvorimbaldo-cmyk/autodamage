import { Pool, type PoolClient } from 'pg';

const state = globalThis as typeof globalThis & { localDatabasePool?: Pool };

export function localPool() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL para PostgreSQL local');
  state.localDatabasePool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  return state.localDatabasePool;
}

export async function transaction<T>(
  operation: (db: PoolClient) => Promise<T>,
  usuarioId?: string,
) {
  const db = await localPool().connect();
  try {
    await db.query('BEGIN');
    if (usuarioId) await db.query("SELECT set_config('app.usuario_id', $1, true)", [usuarioId]);
    const value = await operation(db);
    await db.query('COMMIT');
    return value;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

function identifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('Identificador SQL inválido');
  return '"' + value + '"';
}

type Row = Record<string, unknown>;
type Result = {
  data: Row[] | Row | null;
  count: number | null;
  error: { code: string; message: string } | null;
};
const tables = new Set([
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
]);
const functions = new Set([
  'ping',
  'registrar_dictamen_atomico',
  'avanzar_orden_atomico',
  'emitir_orden_atomico',
  'registrar_imagen_atomica',
  'entregar_ampliacion_atomica',
  'guardar_analisis_atomico',
  'fallar_analisis_reservado',
  'recuperar_analisis_detenido',
  'consultar_coordinacion',
  'enviar_mensaje_siniestro',
  'programar_entrega',
]);

function databaseError(error: unknown) {
  const e = error as { code?: string; message?: string };
  return { code: e.code ?? 'LOCAL_DATABASE_ERROR', message: e.message ?? 'Error de PostgreSQL' };
}

/** Ejecuta el contrato de consultas existente directamente en PostgreSQL. */
class LocalQuery implements PromiseLike<Result> {
  private columns = '*';
  private filters: string[] = [];
  private parameters: unknown[] = [];
  private ordering: string[] = [];
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private rows: Row[] = [];
  private changes: Row = {};
  private offset = 0;
  private size?: number;
  private singular = false;
  private required = false;
  private head = false;
  private count = false;

  constructor(private readonly table: string) {
    if (!tables.has(table)) throw new Error('Tabla no admitida');
  }
  select(columns = '*', options?: { head?: boolean; count?: string }) {
    this.columns =
      columns === '*'
        ? '*'
        : columns
            .split(',')
            .map((c) => identifier(c.trim()))
            .join(',');
    this.head = options?.head ?? false;
    this.count = !!options?.count;
    return this;
  }
  private parameter(value: unknown) {
    this.parameters.push(value);
    return '$' + this.parameters.length;
  }
  private filter(column: string, operator: string, value: unknown) {
    this.filters.push(identifier(column) + operator + this.parameter(value));
    return this;
  }
  eq(column: string, value: unknown) {
    return this.filter(column, ' = ', value);
  }
  neq(column: string, value: unknown) {
    return this.filter(column, ' <> ', value);
  }
  gte(column: string, value: unknown) {
    return this.filter(column, ' >= ', value);
  }
  lt(column: string, value: unknown) {
    return this.filter(column, ' < ', value);
  }
  in(column: string, values: unknown[]) {
    this.filters.push(
      values.length
        ? identifier(column) + ' IN (' + values.map((v) => this.parameter(v)).join(',') + ')'
        : 'FALSE',
    );
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.ordering.push(identifier(column) + (options?.ascending === false ? ' DESC' : ' ASC'));
    return this;
  }
  limit(size: number) {
    this.size = size;
    return this;
  }
  range(start: number, end: number) {
    this.offset = start;
    this.size = end - start + 1;
    return this;
  }
  single() {
    this.singular = true;
    this.required = true;
    return this;
  }
  maybeSingle() {
    this.singular = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.operation = 'insert';
    this.rows = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  update(changes: Row) {
    this.operation = 'update';
    this.changes = changes;
    return this;
  }
  delete() {
    this.operation = 'delete';
    return this;
  }

  private value(column: string, value: unknown) {
    return this.parameter(
      ['bbox', 'respuesta_ia', 'datos'].includes(column) && value != null
        ? JSON.stringify(value)
        : value,
    );
  }
  private async execute(): Promise<Result> {
    try {
      const table = 'public.' + identifier(this.table);
      const where = this.filters.length ? ' WHERE ' + this.filters.join(' AND ') : '';
      let sql: string;
      if (this.operation === 'select') {
        const order = this.ordering.length ? ' ORDER BY ' + this.ordering.join(',') : '';
        const limit = this.head
          ? ' LIMIT 0'
          : this.size === undefined
            ? ''
            : ' LIMIT ' + this.parameter(this.size);
        const offset = this.offset ? ' OFFSET ' + this.parameter(this.offset) : '';
        sql = `WITH selected AS (SELECT * FROM ${table}${where}) SELECT COALESCE(json_agg(p), '[]') AS data, ${this.count ? '(SELECT count(*)::INT FROM selected)' : 'NULL'} AS count FROM (SELECT ${this.columns} FROM selected${order}${limit}${offset}) p`;
      } else {
        let statement: string;
        if (this.operation === 'insert') {
          if (!this.rows.length) return { data: [], count: null, error: null };
          const keys = [...new Set(this.rows.flatMap((row) => Object.keys(row)))];
          const values = this.rows
            .map(
              (row) =>
                '(' +
                keys.map((key) => (key in row ? this.value(key, row[key]) : 'DEFAULT')).join(',') +
                ')',
            )
            .join(',');
          statement = `INSERT INTO ${table} (${keys.map(identifier).join(',')}) VALUES ${values}`;
        } else if (this.operation === 'update') {
          const changes = Object.entries(this.changes).map(
            ([key, value]) => identifier(key) + '=' + this.value(key, value),
          );
          if (!changes.length) return { data: [], count: null, error: null };
          if (!where) throw new Error('La actualización requiere filtros');
          statement = `UPDATE ${table} SET ${changes.join(',')}${where}`;
        } else {
          if (!where) throw new Error('El borrado requiere filtros');
          statement = `DELETE FROM ${table}${where}`;
        }
        sql = `WITH changed AS (${statement} RETURNING *) SELECT COALESCE(json_agg(changed), '[]') AS data, NULL AS count FROM changed`;
      }
      const { rows } = await localPool().query<{ data: Row[]; count: number | null }>(
        sql,
        this.parameters,
      );
      const result = rows[0];
      if (this.singular && (result.data.length > 1 || (this.required && result.data.length !== 1)))
        return {
          data: null,
          count: result.count,
          error: { code: 'PGRST116', message: 'Cantidad de filas inesperada' },
        };
      return {
        data: this.head ? null : this.singular ? (result.data[0] ?? null) : result.data,
        count: result.count,
        error: null,
      };
    } catch (error) {
      return { data: null, count: null, error: databaseError(error) };
    }
  }
  then<TResult1 = Result, TResult2 = never>(
    fulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(fulfilled, rejected);
  }
}

export class LocalDatabase {
  constructor(private readonly usuarioId?: string) {}
  from(table: string) {
    return new LocalQuery(table);
  }
  async rpc(name: string, args: Record<string, unknown> = {}) {
    if (!functions.has(name)) throw new Error('Operación no admitida');
    const keys = Object.keys(args);
    const parameters = keys.map((key) =>
      Array.isArray(args[key]) ? JSON.stringify(args[key]) : args[key],
    );
    const query = `SELECT public.${identifier(name)}(${keys.map((key, i) => identifier(key) + ' => $' + (i + 1)).join(',')}) AS data`;
    try {
      const result = await transaction((db) => db.query(query, parameters), this.usuarioId);
      return { data: result.rows[0].data, error: null };
    } catch (error) {
      return { data: null, error: databaseError(error) };
    }
  }
}
