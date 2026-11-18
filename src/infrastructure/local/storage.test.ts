import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalStorageService, verificarFirma } from './storage';

describe('Evidencias locales privadas', () => {
  let directory: string;
  const storage = new LocalStorageService();
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'autodamage-storage-'));
    vi.stubEnv('LOCAL_STORAGE_DIR', directory);
    vi.stubEnv('LOCAL_STORAGE_SECRET', 'secreto-de-prueba-no-real');
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });
  it('conserva el contenido y evita sobrescribir una evidencia', async () => {
    const input = {
      camino: 'caso/foto.jpg',
      contenido: Buffer.from('evidencia'),
      tipoMime: 'image/jpeg',
    };
    await storage.subir(input);
    expect(await storage.descargar(input.camino)).toEqual(input.contenido);
    await expect(storage.subir(input)).rejects.toMatchObject({ code: 'EEXIST' });
    await storage.eliminar(input.camino);
    await expect(storage.descargar(input.camino)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rechaza rutas que salen de la carpeta privada', async () => {
    for (const path of ['../privado', '..\\privado', '', 'foto\0.jpg']) {
      await expect(storage.descargar(path)).rejects.toThrow('Ruta de evidencia inválida');
    }
  });
  it('la firma caduca y no permite cambiar el archivo ni el vencimiento', async () => {
    const url = new URL(await storage.urlFirmado('caso/foto.jpg', 60), 'http://localhost');
    const expira = url.searchParams.get('expira')!;
    const firma = url.searchParams.get('firma')!;
    expect(verificarFirma('caso/foto.jpg', expira, firma)).toBe(true);
    expect(verificarFirma('otro/foto.jpg', expira, firma)).toBe(false);
    expect(verificarFirma('caso/foto.jpg', String(Number(expira) + 60), firma)).toBe(false);
    expect(verificarFirma('caso/foto.jpg', '1000000000', firma)).toBe(false);
    expect(verificarFirma('caso/foto.jpg', expira, 'invalida')).toBe(false);
  });
});
