import { analisisIaSchema } from './ai-schema';
import { describe, expect, it } from 'vitest';

const analisisValido = {
  vehiculo: { marca: 'Toyota', modelo: 'Corolla' },
  piezas_detectadas: [
    {
      codigo_pieza: 'FARO_DEL_IZQ',
      accion: 'SUSTITUIR',
      confianza: 0.95,
      imagen_indice: 0,
      bbox: [120, 80, 260, 300],
    },
  ],
  nivel_severidad: 'LEVE',
  indicadores_estructurales: { dano_estructural: false, airbags: false, perdida_total: false },
  sospecha_recaptura: false,
  motivo_recaptura: null,
  confianza_global: 0.93,
};

describe('analisisIaSchema', () => {
  it.each([
    [-1, 0, 100, 100],
    [0, 0, 1001, 100],
    [100, 0, 0, 100],
    [0, 100, 100, 0],
    [0, 0, 0, 100],
    [0, 0, 100, 0],
  ])('debería rechazar una caja fuera del rango o sin área: %j', (...bbox) => {
    expect(
      analisisIaSchema.safeParse({
        ...analisisValido,
        piezas_detectadas: [{ ...analisisValido.piezas_detectadas[0], bbox }],
      }).success,
    ).toBe(false);
  });

  it('debería aceptar una caja que ocupa la imagen completa', () => {
    expect(
      analisisIaSchema.safeParse({
        ...analisisValido,
        piezas_detectadas: [{ ...analisisValido.piezas_detectadas[0], bbox: [0, 0, 1000, 1000] }],
      }).success,
    ).toBe(true);
  });
  it('acepta un análisis válido completo', () => {
    const resultado = analisisIaSchema.safeParse(analisisValido);
    expect(resultado.success).toBe(true);
  });

  it('acepta sin piezas detectadas', () => {
    const resultado = analisisIaSchema.safeParse({ ...analisisValido, piezas_detectadas: [] });
    expect(resultado.success).toBe(true);
  });

  it('acecha indicadores estructurales en true', () => {
    const resultado = analisisIaSchema.safeParse({
      ...analisisValido,
      indicadores_estructurales: { dano_estructural: true, airbags: true, perdida_total: false },
    });
    expect(resultado.success).toBe(true);
  });

  it('rechaza severidad inválida', () => {
    const resultado = analisisIaSchema.safeParse({
      ...analisisValido,
      nivel_severidad: 'CRITICO',
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza confianza mayor que 1', () => {
    const resultado = analisisIaSchema.safeParse({
      ...analisisValido,
      piezas_detectadas: [{ ...analisisValido.piezas_detectadas[0], confianza: 1.5 }],
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza confianza global negativa', () => {
    const resultado = analisisIaSchema.safeParse({
      ...analisisValido,
      confianza_global: -0.1,
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza bbox con 3 valores', () => {
    const resultado = analisisIaSchema.safeParse({
      ...analisisValido,
      piezas_detectadas: [{ ...analisisValido.piezas_detectadas[0], bbox: [1, 2, 3] }],
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza acción inválida', () => {
    const resultado = analisisIaSchema.safeParse({
      ...analisisValido,
      piezas_detectadas: [{ ...analisisValido.piezas_detectadas[0], accion: 'REEMPLAZAR' }],
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza código de pieza vacío', () => {
    const resultado = analisisIaSchema.safeParse({
      ...analisisValido,
      piezas_detectadas: [{ ...analisisValido.piezas_detectadas[0], codigo_pieza: '' }],
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza imagen_indice negativo', () => {
    const resultado = analisisIaSchema.safeParse({
      ...analisisValido,
      piezas_detectadas: [{ ...analisisValido.piezas_detectadas[0], imagen_indice: -1 }],
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza motivo_recaptura no nulo cuando es string vacío permitido', () => {
    // string vacío SÍ es válido (es string | null)
    const resultado = analisisIaSchema.safeParse({
      ...analisisValido,
      sospecha_recaptura: true,
      motivo_recaptura: '',
    });
    expect(resultado.success).toBe(true);
  });

  it('rechaza vehiculo con marca numérica', () => {
    const resultado = analisisIaSchema.safeParse({
      ...analisisValido,
      vehiculo: { marca: 123, modelo: null },
    });
    expect(resultado.success).toBe(false);
  });
});
