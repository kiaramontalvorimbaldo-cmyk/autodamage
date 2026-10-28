import { describe, expect, it } from 'vitest';
import { MockProvider } from './mock-provider';
import { AiInvalidResponseError } from '@/application/ports/ai-provider';

describe('MockProvider', () => {
  it('devuelve el fixture del escenario "leve-faro"', async () => {
    const proveedor = new MockProvider('leve-faro');
    const resultado = await proveedor.analizarDanos({
      imagenes: [],
      codigosPiezasValidos: [],
    });

    expect(resultado.nivel_severidad).toBe('LEVE');
    expect(resultado.piezas_detectadas[0].codigo_pieza).toBe('FARO_DEL_IZQ');
    expect(resultado.confianza_global).toBe(0.93);
  });

  it.each([
    ['moderado-puerta', 'MODERADO'],
    ['severo-estructural', 'SEVERO'],
    ['recaptura', 'LEVE'],
    ['baja-confianza', 'LEVE'],
    ['sin-piezas', 'LEVE'],
  ] as const)('devuelve el fixture "%s" (%s)', async (escenario, severidad) => {
    const proveedor = new MockProvider(escenario);
    const resultado = await proveedor.analizarDanos({
      imagenes: [],
      codigosPiezasValidos: [],
    });
    expect(resultado.nivel_severidad).toBe(severidad);
  });

  it('escenario "recaptura" marca sospecha_recaptura', async () => {
    const proveedor = new MockProvider('recaptura');
    const resultado = await proveedor.analizarDanos({
      imagenes: [],
      codigosPiezasValidos: [],
    });
    expect(resultado.sospecha_recaptura).toBe(true);
    expect(resultado.motivo_recaptura).toContain('moiré');
  });

  it('escenario "cuota-agotada" lanza AiUnavailableError', async () => {
    const proveedor = new MockProvider('cuota-agotada');
    await expect(
      proveedor.analizarDanos({ imagenes: [], codigosPiezasValidos: [] }),
    ).rejects.toMatchObject({ code: 'CUOTA_AGOTADA' });
  });

  it('escenario "json-invalido" lanza AiInvalidResponseError', async () => {
    const proveedor = new MockProvider('json-invalido');
    await expect(
      proveedor.analizarDanos({ imagenes: [], codigosPiezasValidos: [] }),
    ).rejects.toBeInstanceOf(AiInvalidResponseError);
  });

  it('escenario por defecto es "leve-faro"', async () => {
    const proveedor = new MockProvider();
    const resultado = await proveedor.analizarDanos({
      imagenes: [],
      codigosPiezasValidos: [],
    });
    expect(resultado.piezas_detectadas[0].codigo_pieza).toBe('FARO_DEL_IZQ');
  });

  it('respeta MOCK_AI_SCENARIO si está definido en el entorno', async () => {
    const original = process.env.MOCK_AI_SCENARIO;
    try {
      process.env.MOCK_AI_SCENARIO = 'moderado-puerta';
      const proveedor = new MockProvider();
      const resultado = await proveedor.analizarDanos({
        imagenes: [],
        codigosPiezasValidos: [],
      });
      expect(resultado.nivel_severidad).toBe('MODERADO');
    } finally {
      process.env.MOCK_AI_SCENARIO = original;
    }
  });
});
