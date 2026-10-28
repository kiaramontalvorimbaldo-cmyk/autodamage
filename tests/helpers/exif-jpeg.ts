/**
 * Helpers para construir fixtures de imagen en pruebas.
 */

/** JPEG mínimo SIN metadatos (equivalente a una captura de canvas). */
export function jpegSinExif(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
}

/**
 * JPEG mínimo con EXIF Make="Canon" (simula un archivo
 * de cámara o galería: debe ser rechazado como no en vivo).
 */
export function jpegConExif(): Buffer {
  const payload = Buffer.from([
    // "Exif\0\0"
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    // TIFF: little-endian, 0x002A, IFD0 en offset 8
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    // IFD0: 1 entrada
    0x01, 0x00,
    // entrada: tag 0x010F (Make), type 2 (ASCII), count 6, value offset 26
    0x0f, 0x01, 0x02, 0x00, 0x06, 0x00, 0x00, 0x00, 0x1a, 0x00, 0x00, 0x00,
    // next IFD offset: 0
    0x00, 0x00, 0x00, 0x00,
    // offset 26: "Canon\0"
    0x43, 0x61, 0x6e, 0x6f, 0x6e, 0x00,
  ]);
  const longitud = payload.byteLength + 2;
  const segmento = Buffer.from([0xff, 0xe1, (longitud >> 8) & 0xff, longitud & 0xff]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), segmento, payload, Buffer.from([0xff, 0xd9])]);
}
