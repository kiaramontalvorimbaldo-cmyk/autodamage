import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({ proveedor: vi.fn(), escribir: vi.fn(), csv: '' }));
vi.mock('node:fs', () => ({
  existsSync: () => false,
  writeFileSync: estado.escribir,
  readFileSync: (ruta: string) =>
    ruta.endsWith('baremo.json')
      ? '[{"codigo_pieza":"FARO"}]'
      : ruta.endsWith('etiquetas.csv')
        ? estado.csv
        : Buffer.from('jpeg-de-prueba'),
}));
vi.mock('../../scripts/lib/load-env', () => ({ loadEnvLocal: vi.fn(), requireEnv: () => 'falso' }));
vi.mock('@/infrastructure/ai/gemini-provider', () => ({ GeminiProvider: estado.proveedor }));

describe('comando de evaluación', () => {
  const argvOriginal = process.argv;
  beforeEach(() => {
    vi.resetModules();
    estado.proveedor.mockClear();
    estado.escribir.mockClear();
    estado.csv = 'archivo,severidad,piezas,es_recaptura\nfoto.jpg,LEVE,FARO,false';
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });
  afterEach(() => {
    process.argv = argvOriginal;
    vi.restoreAllMocks();
  });

  it('debería enviar los códigos del baremo y guardar resultados solo con apply', async () => {
    const analizar = vi
      .fn()
      .mockResolvedValue({
        nivel_severidad: 'LEVE',
        piezas_detectadas: [{ codigo_pieza: 'FARO' }],
        sospecha_recaptura: false,
      });
    estado.proveedor.mockImplementation(function () {
      return { analizarDanos: analizar };
    });
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.useFakeTimers();
    try {
      process.argv = ['node', 'evaluar-ia.ts', '--apply'];
      await import('../../scripts/evaluar-ia');
      await vi.runAllTimersAsync();
      expect(analizar).toHaveBeenCalledWith({
        imagenes: [
          { base64: Buffer.from('jpeg-de-prueba').toString('base64'), mimeType: 'image/jpeg' },
        ],
        codigosPiezasValidos: ['FARO'],
      });
      expect(
        estado.escribir.mock.calls.some(([ruta]) => ruta.endsWith('informe-validacion.md')),
      ).toBe(true);
      expect(process.exit).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });

  it('debería comprobar el plan por defecto sin crear proveedor ni guardar informe', async () => {
    process.argv = ['node', 'evaluar-ia.ts'];
    await import('../../scripts/evaluar-ia');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No se llamó a Gemini'));
    expect(estado.proveedor).not.toHaveBeenCalled();
    expect(estado.escribir).not.toHaveBeenCalled();
  });

  it('debería detener un conjunto inválido antes de crear proveedor incluso con apply', async () => {
    estado.csv += '\n../fuera.jpg,LEVE,,false';
    process.argv = ['node', 'evaluar-ia.ts', '--apply'];
    await import('../../scripts/evaluar-ia');
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(1));
    expect(estado.proveedor).not.toHaveBeenCalled();
    expect(estado.escribir).not.toHaveBeenCalled();
  });

  it('debería rechazar opciones desconocidas', async () => {
    process.argv = ['node', 'evaluar-ia.ts', '--todo'];
    await import('../../scripts/evaluar-ia');
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(1));
    expect(estado.proveedor).not.toHaveBeenCalled();
  });
});
