import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import type { StorageService } from '@/application/ports/storage-service';
import { AppError } from '@/lib/errors';

function configuration() {
  if (!process.env.LOCAL_STORAGE_DIR || !process.env.LOCAL_STORAGE_SECRET)
    throw new Error('Falta configurar el almacenamiento local');
  return { root: resolve(process.env.LOCAL_STORAGE_DIR), secret: process.env.LOCAL_STORAGE_SECRET };
}
function location(camino: string) {
  const { root } = configuration();
  const file = resolve(root, camino);
  const path = relative(root, file);
  if (
    !camino ||
    camino.includes('\\') ||
    path.startsWith('..') ||
    file === root ||
    camino.includes('\0')
  )
    throw new AppError('STORAGE_ERROR', 400, 'Ruta de evidencia inválida');
  return file;
}
function signature(path: string, expires: string) {
  return createHmac('sha256', configuration().secret)
    .update(path + '\n' + expires)
    .digest('hex');
}
export function verificarFirma(path: string, expires: string, token: string) {
  if (
    !/^\d{10}$/.test(expires) ||
    Number(expires) < Date.now() / 1000 ||
    !/^[a-f0-9]{64}$/.test(token)
  )
    return false;
  return timingSafeEqual(Buffer.from(signature(path, expires), 'hex'), Buffer.from(token, 'hex'));
}
export class LocalStorageService implements StorageService {
  async subir({ camino, contenido }: { camino: string; contenido: Buffer; tipoMime: string }) {
    const file = location(camino);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, contenido, { flag: 'wx', mode: 0o600 });
  }
  async descargar(camino: string) {
    return readFile(location(camino));
  }
  async eliminar(camino: string) {
    await unlink(location(camino));
  }
  async urlFirmado(camino: string, segundos: number) {
    location(camino);
    const expires = String(Math.floor(Date.now() / 1000) + segundos);
    return (
      '/api/evidencias/' +
      camino.split('/').map(encodeURIComponent).join('/') +
      '?expira=' +
      expires +
      '&firma=' +
      signature(camino, expires)
    );
  }
  async urlFirmados(caminos: string[], segundos: number) {
    return Promise.all(caminos.map((path) => this.urlFirmado(path, segundos)));
  }
}
