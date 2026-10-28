import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { calcularDHash } from './dhash';

describe('calcularDHash', () => {
  const colores = (r: number, g: number, b: number) => ({ r, g, b });

  async function crearJpg(
    ancho: number,
    alto: number,
    pixel: (x: number, y: number) => { r: number; g: number; b: number },
  ): Promise<Buffer> {
    const crudo = Buffer.alloc(ancho * alto * 3);
    for (let y = 0; y < alto; y += 1) {
      for (let x = 0; x < ancho; x += 1) {
        const p = pixel(x, y);
        const i = (y * ancho + x) * 3;
        crudo[i] = p.r;
        crudo[i + 1] = p.g;
        crudo[i + 2] = p.b;
      }
    }
    return sharp(crudo, { raw: { width: ancho, height: alto, channels: 3 } })
      .jpeg()
      .toBuffer();
  }

  it('genera un hash de 16 caracteres hexadecimales', async () => {
    const jpg = await crearJpg(64, 64, (x) => colores(x * 4, x * 4, x * 4));
    const hash = await calcularDHash(jpg);
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9A-F]{16}$/);
  });

  it('imágenes idénticas producen el mismo hash', async () => {
    const pixel = (x: number, y: number) => colores((x + y) * 3, (x + y) * 3, (x + y) * 3);
    const [a, b] = await Promise.all([crearJpg(80, 60, pixel), crearJpg(80, 60, pixel)]);
    expect(await calcularDHash(a)).toBe(await calcularDHash(b));
  });

  it('imágenes muy distintas producen hashes distintos', async () => {
    const uniforme = await crearJpg(80, 60, () => colores(10, 10, 10));
    const conDegradado = await crearJpg(80, 60, (x) => colores(x * 3, x * 3, x * 3));
    expect(await calcularDHash(uniforme)).not.toBe(await calcularDHash(conDegradado));
  });

  it('imágenes con gradiente similar tienen distancia Hamming baja', async () => {
    const g1 = await crearJpg(80, 60, (x) => colores(x * 3, x * 3, x * 3));
    const g2 = await crearJpg(80, 60, (x) => colores(x * 3 + 5, x * 3 + 5, x * 3 + 5));
    const [h1, h2] = [await calcularDHash(g1), await calcularDHash(g2)];
    // bits que difieren
    const a = BigInt(`0x${h1}`);
    const b = BigInt(`0x${h2}`);
    const diff = a ^ b;
    let bits = 0;
    let d = diff;
    while (d > 0n) {
      bits += Number(d & 1n);
      d >>= 1n;
    }
    expect(bits).toBeLessThanOrEqual(5);
  });
});
