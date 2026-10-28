import type { StorageService } from '@/application/ports/storage-service';

/**
 * Almacenamiento en memoria para pruebas.
 */
export class InMemoryStorageService implements StorageService {
  private archivos = new Map<string, Buffer>();

  async subir(input: { camino: string; contenido: Buffer; tipoMime: string }): Promise<void> {
    this.archivos.set(input.camino, input.contenido);
  }

  async descargar(camino: string): Promise<Buffer> {
    const contenido = this.archivos.get(camino);
    if (!contenido) {
      throw new Error('Archivo no encontrado en storage');
    }
    return contenido;
  }

  async eliminar(camino: string): Promise<void> {
    this.archivos.delete(camino);
  }

  async urlFirmado(camino: string, _expiracionSegundos: number): Promise<string> {
    return `https://storage.test/${camino}?firma=mock`;
  }

  /** Mapa interno para aserciones en pruebas. */
  contenido(camino: string): Buffer | undefined {
    return this.archivos.get(camino);
  }
}
