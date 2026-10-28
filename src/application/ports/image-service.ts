/**
 * Puerto del servicio de imágenes (hash perceptual y
 * detección de archivos no capturados en vivo).
 */
export interface ImageService {
  /** dHash de 64 bits en 16 caracteres hexadecimales. */
  calcularDHash(imagen: Buffer): Promise<string>;
  /** True si la imagen tiene metadatos de cámara/galería (no es captura en vivo). */
  esArchivoNoEnVivo(imagen: Buffer): Promise<boolean>;
}
