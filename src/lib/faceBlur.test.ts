import { describe, it, expect, vi } from 'vitest';
import {
  calcularRegionConMargen,
  difuminarRostros,
  difuminarRegion,
  procesarImagen,
  aRostros,
  MARGEN_ROSTRO,
  type Rostro,
  type Difuminador,
} from './faceBlur';

const ANCHO = 1000;
const ALTO = 800;

function lienzoFalso(): HTMLCanvasElement {
  return { width: ANCHO, height: ALTO } as unknown as HTMLCanvasElement;
}

describe('calcularRegionConMargen', () => {
  it('debería expandir el rostro con el margen del 15%', () => {
    const rostro: Rostro = { x: 100, y: 100, ancho: 100, alto: 100 };
    const region = calcularRegionConMargen(rostro, ANCHO, ALTO);
    // 100 - 15 = 85; 100 + 30 = 130
    expect(region.x).toBeCloseTo(85);
    expect(region.y).toBeCloseTo(85);
    expect(region.ancho).toBeCloseTo(130);
    expect(region.alto).toBeCloseTo(130);
  });

  it('debería limitar la región a los bordes del lienzo', () => {
    const rostro: Rostro = { x: 0, y: 0, ancho: 50, alto: 50 };
    const region = calcularRegionConMargen(rostro, ANCHO, ALTO);
    expect(region.x).toBe(0);
    expect(region.y).toBe(0);
    expect(region.ancho).toBeCloseTo(65);
  });

  it('debería respetar un margen personalizado', () => {
    const rostro: Rostro = { x: 200, y: 200, ancho: 100, alto: 100 };
    const region = calcularRegionConMargen(rostro, ANCHO, ALTO, 0.5);
    expect(region.x).toBeCloseTo(150);
    expect(region.ancho).toBeCloseTo(200);
  });

  it('debería usar el margen por defecto del 15%', () => {
    expect(MARGEN_ROSTRO).toBe(0.15);
  });
});

describe('aRostros', () => {
  it('debería convertir detecciones de MediaPipe a Rostro', () => {
    const detecciones = [
      {
        boundingBox: { originX: 10, originY: 20, width: 100, height: 120 },
      },
      {
        boundingBox: { originX: 200, originY: 300, width: 50, height: 60 },
      },
    ];
    expect(aRostros(detecciones)).toEqual([
      { x: 10, y: 20, ancho: 100, alto: 120 },
      { x: 200, y: 300, ancho: 50, alto: 60 },
    ]);
  });

  it('debería filtrar detecciones sin tamaño válido', () => {
    expect(aRostros([{ boundingBox: { originX: 0, originY: 0, width: 0, height: 0 } }])).toEqual(
      [],
    );
    expect(aRostros(undefined)).toEqual([]);
  });
});

describe('difuminarRostros', () => {
  it('debería pixelar con un lienzo auxiliar sin depender del filtro del navegador', () => {
    const reducido = { drawImage: vi.fn() };
    const auxiliar = { width: 0, height: 0, getContext: () => reducido };
    const contexto = {
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      imageSmoothingEnabled: true,
    };
    const canvas = { getContext: () => contexto } as unknown as HTMLCanvasElement;
    vi.stubGlobal('document', { createElement: () => auxiliar });
    try {
      difuminarRegion(canvas, { x: 10, y: 20, ancho: 100, alto: 120 });
      expect(reducido.drawImage).toHaveBeenCalledWith(canvas, 10, 20, 100, 120, 0, 0, 8, 8);
      expect(contexto.drawImage).toHaveBeenCalledWith(auxiliar, 0, 0, 8, 8, 10, 20, 100, 120);
      expect(contexto.imageSmoothingEnabled).toBe(false);
      expect(contexto.restore).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('debería bloquear la imagen si no hay contexto para ocultar los rostros', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => difuminarRegion(canvas, { x: 0, y: 0, ancho: 20, alto: 20 })).toThrow(
      'LIENZO_NO_DISPONIBLE',
    );
  });
  it('debería invocar el difuminador una vez por rostro con su región', () => {
    const rostros: Rostro[] = [
      { x: 100, y: 100, ancho: 100, alto: 100 },
      { x: 500, y: 100, ancho: 100, alto: 100 },
      { x: 300, y: 500, ancho: 100, alto: 100 },
    ];
    const llamadas: Rostro[] = [];
    const difuminador: Difuminador = (_canvas, region) => {
      llamadas.push(region);
    };
    const resultado = difuminarRostros(lienzoFalso(), rostros, difuminador);
    expect(resultado).toBe(3);
    expect(llamadas).toHaveLength(3);
    // Cada región tiene el margen aplicado.
    for (const region of llamadas) {
      expect(region.ancho).toBeCloseTo(130);
      expect(region.alto).toBeCloseTo(130);
    }
  });

  it('debería devolver 0 con cero rostros (sin tocar el lienzo)', () => {
    const difuminador = vi.fn();
    const resultado = difuminarRostros(lienzoFalso(), [], difuminador as Difuminador);
    expect(resultado).toBe(0);
    expect(difuminador).not.toHaveBeenCalled();
  });
});

describe('procesarImagen', () => {
  it('debería difuminar N rostros con el margen del 15%', async () => {
    const detector = {
      detectar: () => [
        { x: 100, y: 100, ancho: 100, alto: 100 },
        { x: 500, y: 100, ancho: 100, alto: 100 },
      ],
    };
    const llamadas: Rostro[] = [];
    const resultado = await procesarImagen(
      lienzoFalso(),
      async () => detector,
      (_canvas, region) => llamadas.push(region),
    );
    expect(resultado).toBe(2);
    expect(llamadas).toHaveLength(2);
    expect(llamadas[0].ancho).toBeCloseTo(130);
  });

  it('debería no difuminar nada con 0 rostros', async () => {
    const difuminador = vi.fn();
    const resultado = await procesarImagen(
      lienzoFalso(),
      async () => ({ detectar: () => [] }),
      difuminador as Difuminador,
    );
    expect(resultado).toBe(0);
    expect(difuminador).not.toHaveBeenCalled();
  });

  it('debería lanzar si el detector falla (fail-closed)', async () => {
    await expect(
      procesarImagen(
        lienzoFalso(),
        async () => {
          throw new Error('MODELO_NO_CARGADO');
        },
        () => undefined,
      ),
    ).rejects.toThrow('MODELO_NO_CARGADO');
  });

  it('debería lanzar si la detección falla (fail-closed)', async () => {
    const detector = {
      detectar: () => {
        throw new Error('DETECCION_FALLIDA');
      },
    };
    await expect(
      procesarImagen(
        lienzoFalso(),
        async () => detector,
        () => undefined,
      ),
    ).rejects.toThrow('DETECCION_FALLIDA');
  });
});
