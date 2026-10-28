import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calcularDimensiones, comprimirImagen, LADO_MAXIMO_POR_DEFECTO } from './compressImage';

// jsdom no implementa el contexto 2D de canvas: lo simulamos.
const dibujarImagen = vi.fn();

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: dibujarImagen,
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('calcularDimensiones', () => {
  it.each([
    { ancho: 4000, alto: 3000, esperado: { ancho: 1280, alto: 960 } },
    { ancho: 3000, alto: 4000, esperado: { ancho: 960, alto: 1280 } },
    { ancho: 1000, alto: 800, esperado: { ancho: 1000, alto: 800 } },
    { ancho: 1280, alto: 720, esperado: { ancho: 1280, alto: 720 } },
    { ancho: 1920, alto: 1080, esperado: { ancho: 1280, alto: 720 } },
  ])('debería escalar $ancho x $alto correctamente', ({ ancho, alto, esperado }) => {
    expect(calcularDimensiones(ancho, alto)).toEqual(esperado);
  });

  it('debería respetar un lado máximo personalizado', () => {
    expect(calcularDimensiones(2000, 1000, 500)).toEqual({
      ancho: 500,
      alto: 250,
    });
  });

  it('debería lanzar con dimensiones no positivas', () => {
    expect(() => calcularDimensiones(0, 100)).toThrow();
    expect(() => calcularDimensiones(100, -5)).toThrow();
  });

  it('debería conservar la proporción (caso cuadrado)', () => {
    const resultado = calcularDimensiones(3000, 3000);
    expect(resultado.ancho).toBe(resultado.alto);
    expect(resultado.ancho).toBe(1280);
  });
});

describe('comprimirImagen', () => {
  it('debería devolver un Blob image/jpeg con el lado limitado', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 3000;
    canvas.height = 2000;

    const blobsOriginales = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
      expect(this.width).toBe(1280);
      expect(this.height).toBe(853);
      callback(new Blob(['jpeg'], { type: 'image/jpeg' }));
    };

    try {
      const blob = await comprimirImagen(canvas);
      expect(blob.type).toBe('image/jpeg');
      expect(dibujarImagen).toHaveBeenCalledWith(canvas, 0, 0, 1280, 853);
    } finally {
      HTMLCanvasElement.prototype.toBlob = blobsOriginales;
    }
  });

  it('debería usar calidad 0.7 por defecto', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;

    const blobsOriginales = HTMLCanvasElement.prototype.toBlob;
    let calidadRecibida = -1;
    HTMLCanvasElement.prototype.toBlob = function (
      callback: BlobCallback,
      tipo?: string,
      calidad?: number,
    ) {
      calidadRecibida = calidad ?? -1;
      callback(new Blob(['jpeg'], { type: tipo }));
    };

    try {
      await comprimirImagen(canvas);
      expect(calidadRecibida).toBeCloseTo(0.7);
    } finally {
      HTMLCanvasElement.prototype.toBlob = blobsOriginales;
    }
  });

  it('debería lanzar si no se puede exportar', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;

    const blobsOriginales = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
      callback(null);
    };

    try {
      await expect(comprimirImagen(canvas)).rejects.toThrow(
        'No se pudo exportar la imagen como JPEG',
      );
    } finally {
      HTMLCanvasElement.prototype.toBlob = blobsOriginales;
    }
  });
});

describe('constantes', () => {
  it('debería tener el lado máximo por defecto en 1280', () => {
    expect(LADO_MAXIMO_POR_DEFECTO).toBe(1280);
  });
});
