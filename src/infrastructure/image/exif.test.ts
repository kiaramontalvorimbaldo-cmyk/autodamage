import { describe, expect, it } from 'vitest';
import { esArchivoNoEnVivo, leerExif } from './exif';

describe('esArchivoNoEnVivo', () => {
  it('sin metadatos → archivo en vivo', () => {
    expect(esArchivoNoEnVivo({})).toBe(false);
  });

  it('con Make → archivo de cámara', () => {
    expect(esArchivoNoEnVivo({ marca: 'Canon' })).toBe(true);
  });

  it('con Model → archivo de cámara', () => {
    expect(esArchivoNoEnVivo({ modelo: 'iPhone 14' })).toBe(true);
  });

  it('con DateTimeOriginal → archivo de galería', () => {
    expect(esArchivoNoEnVivo({ fechaOriginal: '2024:01:01 10:00:00' })).toBe(true);
  });
});

describe('leerExif', () => {
  it('sin EXIF devuelve {}', async () => {
    // JPEG mínimo sin metadatos: SOI + EOI
    const jpgVacio = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    await expect(leerExif(jpgVacio)).resolves.toEqual({});
  });
});
