import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type PiezaBaremo = {
  codigo_pieza: string;
  pieza_nombre: string;
  costo_repuesto_base: number;
  horas_mano_obra: number;
};

const baremo = JSON.parse(
  readFileSync(resolve(process.cwd(), 'supabase/seed/baremo.json'), 'utf8'),
) as PiezaBaremo[];

describe('seed del baremo (supabase/seed/baremo.json)', () => {
  it('tiene exactamente 20 piezas', () => {
    expect(baremo).toHaveLength(20);
  });

  it('tiene códigos de pieza únicos', () => {
    const codigos = baremo.map((p) => p.codigo_pieza);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it('tiene costos de repuesto no negativos y horas de mano de obra positivas', () => {
    for (const pieza of baremo) {
      expect(pieza.costo_repuesto_base).toBeGreaterThanOrEqual(0);
      expect(pieza.horas_mano_obra).toBeGreaterThan(0);
    }
  });

  it('tiene nombres de pieza legibles en español', () => {
    for (const pieza of baremo) {
      expect(pieza.pieza_nombre.trim().length).toBeGreaterThan(2);
    }
  });

  it('incluye las piezas clave del baremo', () => {
    const codigos = baremo.map((p) => p.codigo_pieza);
    expect(codigos).toContain('PARAGOLPES_DEL');
    expect(codigos).toContain('FARO_DEL_IZQ');
    expect(codigos).toContain('PUERTA_DEL_IZQ');
    expect(codigos).toContain('TAPA_COMBUSTIBLE');
  });

  it('la pieza FARO_DEL_IZQ cuesta 120 USD y requiere 1.0 hora de MO', () => {
    const faro = baremo.find((p) => p.codigo_pieza === 'FARO_DEL_IZQ');
    expect(faro).toBeDefined();
    expect(faro?.costo_repuesto_base).toBe(120);
    expect(faro?.horas_mano_obra).toBe(1.0);
  });
});
