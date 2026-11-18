import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), release: vi.fn() }));
vi.mock('pg', () => ({
  Pool: class {
    query = mocks.query;
    connect = mocks.connect;
  },
}));
import { LocalDatabase, transaction } from './database';

describe('Consultas PostgreSQL locales', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://prueba');
    mocks.query.mockReset().mockResolvedValue({ rows: [{ data: [], count: null }] });
    mocks.release.mockReset();
    mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
  });
  afterEach(() => vi.unstubAllEnvs());
  it('parametriza los datos del usuario sin incorporarlos al SQL', async () => {
    const input = "' OR TRUE; --";
    await new LocalDatabase().from('usuarios').select('id').eq('email', input);
    const [sql, values] = mocks.query.mock.calls[0];
    expect(sql).not.toContain(input);
    expect(values).toEqual([input]);
  });
  it('impide tablas y columnas arbitrarias', () => {
    expect(() => new LocalDatabase().from('credenciales')).toThrow('Tabla no admitida');
    expect(() => new LocalDatabase().from('usuarios').eq('id;DROP', 'x')).toThrow(
      'Identificador SQL inválido',
    );
  });
  it('rechaza cambios masivos sin filtros', async () => {
    const db = new LocalDatabase();
    expect((await db.from('usuarios').delete()).error).not.toBeNull();
    expect((await db.from('usuarios').update({ nombre_completo: 'x' })).error).not.toBeNull();
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('mantiene el total al paginar y devuelve números JSON', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ data: [{ costo: 150 }], count: 9 }] });
    const result = await new LocalDatabase()
      .from('baremo_mock')
      .select('*', { count: 'exact' })
      .range(5, 9);
    expect(result).toMatchObject({ data: [{ costo: 150 }], count: 9, error: null });
    expect(mocks.query.mock.calls[0][1]).toEqual([5, 5]);
  });
  it('revierte una transacción fallida y libera la conexión', async () => {
    await expect(
      transaction(async () => {
        throw new Error('fallo');
      }, 'usuario'),
    ).rejects.toThrow('fallo');
    expect(mocks.query.mock.calls.map((c) => c[0])).toEqual([
      'BEGIN',
      "SELECT set_config('app.usuario_id', $1, true)",
      'ROLLBACK',
    ]);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
