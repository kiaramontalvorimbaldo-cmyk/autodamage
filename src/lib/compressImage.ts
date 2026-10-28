/**
 * Compresión de imágenes capturadas en el navegador.
 * Reduce a un máximo de 1280 px por el lado largo (conservando la
 * proporción) y exporta JPEG con calidad 0.7. La salida de canvas
 * no contiene EXIF (requisito anti-fraude: solo fotos en vivo).
 */

export const LADO_MAXIMO_POR_DEFECTO = 1280;
export const CALIDAD_POR_DEFECTO = 0.7;

/** Dimensiones escaladas respetando la proporción. */
export function calcularDimensiones(
  ancho: number,
  alto: number,
  ladoMaximo: number = LADO_MAXIMO_POR_DEFECTO,
): { ancho: number; alto: number } {
  if (ancho <= 0 || alto <= 0) {
    throw new Error('Las dimensiones deben ser positivas');
  }
  const ladoLargo = Math.max(ancho, alto);
  if (ladoLargo <= ladoMaximo) {
    return { ancho, alto };
  }
  const escala = ladoMaximo / ladoLargo;
  return {
    ancho: Math.round(ancho * escala),
    alto: Math.round(alto * escala),
  };
}

/**
 * Comprime un canvas a JPEG.
 * @param canvas lienzo con la imagen (ya con rostros difuminados)
 * @param ladoMaximo lado largo máximo en px (por defecto 1280)
 * @param calidad calidad JPEG 0–1 (por defecto 0.7)
 */
export async function comprimirImagen(
  canvas: HTMLCanvasElement,
  ladoMaximo: number = LADO_MAXIMO_POR_DEFECTO,
  calidad: number = CALIDAD_POR_DEFECTO,
): Promise<Blob> {
  const { ancho, alto } = calcularDimensiones(canvas.width, canvas.height, ladoMaximo);

  const salida = document.createElement('canvas');
  salida.width = ancho;
  salida.height = alto;
  const ctx = salida.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo crear el lienzo de salida');
  }
  ctx.drawImage(canvas, 0, 0, ancho, alto);

  const blob = await new Promise<Blob | null>((resolver) => {
    salida.toBlob((b) => resolver(b), 'image/jpeg', calidad);
  });
  if (!blob) {
    throw new Error('No se pudo exportar la imagen como JPEG');
  }
  return blob;
}
