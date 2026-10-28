import { calcularDHash } from './dhash';
import { esArchivoNoEnVivo, leerExif } from './exif';
import type { ImageService } from '@/application/ports/image-service';

/**
 * Implementación del servicio de imágenes con sharp (dHash)
 * y exifr (metadatos de cámara).
 */
export class SharpImageService implements ImageService {
  async calcularDHash(imagen: Buffer): Promise<string> {
    return calcularDHash(imagen);
  }

  async esArchivoNoEnVivo(imagen: Buffer): Promise<boolean> {
    const exif = await leerExif(imagen);
    return esArchivoNoEnVivo(exif);
  }
}
