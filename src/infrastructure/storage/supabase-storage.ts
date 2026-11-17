import { AppError } from '@/lib/errors';
import { getAdminClient } from '@/infrastructure/supabase/admin-client';
import type { StorageService } from '@/application/ports/storage-service';

const BUCKET_EVIDENCIAS = 'evidencias';

/**
 * Almacenamiento de evidencias en Supabase Storage
 * (bucket privado "evidencias"). Solo el servidor sube
 * y genera URLs firmadas.
 */
export class SupabaseStorageService implements StorageService {
  async subir(input: { camino: string; contenido: Buffer; tipoMime: string }): Promise<void> {
    const supabase = getAdminClient();
    const { error } = await supabase.storage
      .from(BUCKET_EVIDENCIAS)
      .upload(input.camino, input.contenido, {
        contentType: input.tipoMime,
        upsert: false,
      });
    if (error) {
      throw new AppError('STORAGE_ERROR', 502, 'No se pudo guardar la evidencia');
    }
  }

  async descargar(camino: string): Promise<Buffer> {
    const supabase = getAdminClient();
    const { data, error } = await supabase.storage.from(BUCKET_EVIDENCIAS).download(camino);
    if (error || !data) {
      throw new AppError('STORAGE_ERROR', 404, 'No se pudo descargar la evidencia');
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async eliminar(camino: string): Promise<void> {
    const { error } = await getAdminClient().storage.from(BUCKET_EVIDENCIAS).remove([camino]);
    if (error) throw new AppError('STORAGE_ERROR', 502, 'No se pudo limpiar la evidencia');
  }

  async urlFirmados(caminos: string[], expiracionSegundos: number): Promise<string[]> {
    if (caminos.length === 1) return [await this.urlFirmado(caminos[0], expiracionSegundos)];
    const { data, error } = await getAdminClient()
      .storage.from(BUCKET_EVIDENCIAS)
      .createSignedUrls([...new Set(caminos)], expiracionSegundos);
    if (error) throw new AppError('STORAGE_ERROR', 502, 'No se pudo generar la URL firmada');

    const urls = new Map(data.map((item) => [item.path, item.error ? null : item.signedUrl]));
    return caminos.map((camino) => {
      const url = urls.get(camino);
      if (!url) throw new AppError('STORAGE_ERROR', 502, 'No se pudo generar la URL firmada');
      return url;
    });
  }

  async urlFirmado(camino: string, expiracionSegundos: number): Promise<string> {
    const supabase = getAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_EVIDENCIAS)
      .createSignedUrl(camino, expiracionSegundos);
    if (error || !data?.signedUrl) {
      throw new AppError('STORAGE_ERROR', 502, 'No se pudo generar la URL firmada');
    }
    return data.signedUrl;
  }
}
