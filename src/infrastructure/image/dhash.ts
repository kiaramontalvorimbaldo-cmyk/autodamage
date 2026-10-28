import sharp from 'sharp';

/**
 * Hash perceptual diferencial (dHash) de 64 bits.
 *
 * Escala de grises, redimensiona a 9×8, compara cada píxel
 * con su vecino de la derecha: 64 bits → 16 caracteres hex.
 * Imágenes visualmente similares quedan con distancia Hamming baja.
 *
 * @param imagen Buffer con la imagen (JPEG)
 * @returns hash de 16 caracteres hexadecimales
 */
export async function calcularDHash(imagen: Buffer): Promise<string> {
  // 9 columnas × 8 filas, escala de grises, datos crudos
  const { data } = await sharp(imagen)
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 8 filas × 8 comparaciones = 64 bits
  let bits = '';
  for (let fila = 0; fila < 8; fila += 1) {
    for (let columna = 0; columna < 8; columna += 1) {
      const indice = fila * 9 + columna;
      bits += data[indice] < data[indice + 1] ? '1' : '0';
    }
  }

  // Convertir la cadena de bits a 16 caracteres hexadecimales
  let hex = '';
  for (let nibble = 0; nibble < 16; nibble += 1) {
    const trozo = bits.slice(nibble * 4, nibble * 4 + 4);
    hex += parseInt(trozo, 2).toString(16).toUpperCase();
  }
  return hex;
}
