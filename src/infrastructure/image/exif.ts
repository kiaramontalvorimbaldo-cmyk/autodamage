import { parse as exifrParse } from 'exifr';

export interface ExifImagen {
  marca?: string;
  modelo?: string;
  fechaOriginal?: string;
}

/**
 * Lee los metadatos EXIF relevantes de una imagen.
 * Devuelve {} si no tiene EXIF (típico de captura por canvas).
 */
export async function leerExif(imagen: Buffer): Promise<ExifImagen> {
  try {
    const exif = await exifrParse(imagen, {
      pick: ['Make', 'Model', 'DateTimeOriginal'],
    });
    if (!exif) return {};
    return {
      marca: exif.Make,
      modelo: exif.Model,
      fechaOriginal: exif.DateTimeOriginal,
    };
  } catch {
    // Imagen corrupta o sin EXIF legible: tratar como captura en vivo.
    return {};
  }
}

/**
 * Detecta un archivo NO capturado en vivo: si tiene Make,
 * Model o DateTimeOriginal viene de una cámara o galería,
 * no de un canvas (la captura por canvas no escribe EXIF).
 */
export function esArchivoNoEnVivo(exif: ExifImagen): boolean {
  return Boolean(exif.marca || exif.modelo || exif.fechaOriginal);
}
