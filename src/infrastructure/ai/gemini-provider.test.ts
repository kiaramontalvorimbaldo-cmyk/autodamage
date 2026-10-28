import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { GeminiProvider } from './gemini-provider';
import { AiInvalidResponseError, AiUnavailableError } from '@/application/ports/ai-provider';

const server = setupServer();

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
  indicadores_estructurales: {
    dano_estructural: false,
    airbags: false,
    perdida_total: false,
  },
  sospecha_recaptura: false,
  motivo_recaptura: null,
  confianza_global: 0.93,
};

function respuestaGemini(texto: string) {
  return HttpResponse.json({
    candidates: [{ content: { parts: [{ text: texto }] } }],
  });
}

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('GeminiProvider', () => {
  it('debería enviar JSON Schema serializable y no el objeto Zod', async () => {
    server.use(
      http.post(
        'https://generativelanguage.googleapis.com/v1beta/models/:model',
        async ({ request }) => {
          const body = (await request.json()) as {
            generationConfig: {
              responseJsonSchema: { type: string; required: string[] };
              responseSchema?: unknown;
            };
          };
          expect(body.generationConfig.responseJsonSchema.type).toBe('object');
          expect(body.generationConfig.responseJsonSchema.required).toContain('sospecha_recaptura');
          expect(body.generationConfig.responseSchema).toBeUndefined();
          return respuestaGemini(JSON.stringify(analisisValido));
        },
      ),
    );
    await new GeminiProvider({ apiKey: 'test-key' }).analizarDanos({
      imagenes: [{ base64: 'aW1hZ2U=', mimeType: 'image/jpeg' }],
      codigosPiezasValidos: ['FARO_DEL_IZQ'],
    });
  });
  it('debería reintentar y rechazar referencias a imágenes inexistentes', async () => {
    let llamadas = 0;
    server.use(
      http.post('https://generativelanguage.googleapis.com/v1beta/models/:model', () => {
        llamadas += 1;
        return respuestaGemini(
          JSON.stringify({
            ...analisisValido,
            piezas_detectadas: [{ ...analisisValido.piezas_detectadas[0], imagen_indice: 1 }],
          }),
        );
      }),
    );
    const proveedor = new GeminiProvider({ apiKey: 'test-key' });
    await expect(
      proveedor.analizarDanos({
        imagenes: [{ base64: 'aW1hZ2U=', mimeType: 'image/jpeg' }],
        codigosPiezasValidos: ['FARO_DEL_IZQ'],
      }),
    ).rejects.toBeInstanceOf(AiInvalidResponseError);
    expect(llamadas).toBe(2);
  });
  it('analiza con éxito y devuelve el análisis validado', async () => {
    let llamadas = 0;
    server.use(
      http.post('https://generativelanguage.googleapis.com/v1beta/models/:model', () => {
        llamadas += 1;
        return respuestaGemini(JSON.stringify(analisisValido));
      }),
    );

    const proveedor = new GeminiProvider({ apiKey: 'test-key' });
    const resultado = await proveedor.analizarDanos({
      imagenes: [{ base64: 'aW1hZ2U=', mimeType: 'image/jpeg' }],
      codigosPiezasValidos: ['FARO_DEL_IZQ'],
    });

    expect(llamadas).toBe(1);
    expect(resultado.nivel_severidad).toBe('LEVE');
    expect(resultado.piezas_detectadas[0].codigo_pieza).toBe('FARO_DEL_IZQ');
    expect(resultado.confianza_global).toBe(0.93);
    expect(resultado.vehiculo.marca).toBe('Toyota');
  });

  it('JSON inválido: reintenta una vez y tiene éxito', async () => {
    let llamadas = 0;
    server.use(
      http.post('https://generativelanguage.googleapis.com/v1beta/models/:model', () => {
        llamadas += 1;
        if (llamadas === 1) {
          return respuestaGemini('esto no es json {{{');
        }
        return respuestaGemini(JSON.stringify(analisisValido));
      }),
    );

    const proveedor = new GeminiProvider({ apiKey: 'test-key' });
    const resultado = await proveedor.analizarDanos({
      imagenes: [{ base64: 'aW1hZ2U=', mimeType: 'image/jpeg' }],
      codigosPiezasValidos: [],
    });

    expect(llamadas).toBe(2);
    expect(resultado.nivel_severidad).toBe('LEVE');
  });

  it('JSON inválido dos veces → AiInvalidResponseError', async () => {
    let llamadas = 0;
    server.use(
      http.post('https://generativelanguage.googleapis.com/v1beta/models/:model', () => {
        llamadas += 1;
        return respuestaGemini('todavia no es json {{{');
      }),
    );

    const proveedor = new GeminiProvider({ apiKey: 'test-key' });

    await expect(
      proveedor.analizarDanos({ imagenes: [], codigosPiezasValidos: [] }),
    ).rejects.toBeInstanceOf(AiInvalidResponseError);
    expect(llamadas).toBe(2); // intento original + un reintento
  });

  it('respuesta fuera de esquema dos veces → AiInvalidResponseError', async () => {
    let llamadas = 0;
    server.use(
      http.post('https://generativelanguage.googleapis.com/v1beta/models/:model', () => {
        llamadas += 1;
        return respuestaGemini(JSON.stringify({ nivel_severidad: 'INVENTADO' }));
      }),
    );

    const proveedor = new GeminiProvider({ apiKey: 'test-key' });

    await expect(
      proveedor.analizarDanos({ imagenes: [], codigosPiezasValidos: [] }),
    ).rejects.toBeInstanceOf(AiInvalidResponseError);
    expect(llamadas).toBe(2);
  });

  it('error 429 (cuota agotada): SIN reintento → AiUnavailableError CUOTA_AGOTADA', async () => {
    let llamadas = 0;
    server.use(
      http.post('https://generativelanguage.googleapis.com/v1beta/models/:model', () => {
        llamadas += 1;
        return new HttpResponse(null, { status: 429 });
      }),
    );

    const proveedor = new GeminiProvider({ apiKey: 'test-key' });

    await expect(
      proveedor.analizarDanos({ imagenes: [], codigosPiezasValidos: [] }),
    ).rejects.toMatchObject({ code: 'CUOTA_AGOTADA' });
    expect(llamadas).toBe(1); // sin reintento ante 429
  });

  it('error 5xx: reintenta una vez y luego AiUnavailableError', async () => {
    let llamadas = 0;
    server.use(
      http.post('https://generativelanguage.googleapis.com/v1beta/models/:model', () => {
        llamadas += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const proveedor = new GeminiProvider({ apiKey: 'test-key' });

    await expect(
      proveedor.analizarDanos({ imagenes: [], codigosPiezasValidos: [] }),
    ).rejects.toBeInstanceOf(AiUnavailableError);
    expect(llamadas).toBe(2);
  });

  it('timeout: AiUnavailableError', async () => {
    server.use(
      http.post('https://generativelanguage.googleapis.com/v1beta/models/:model', async () => {
        await new Promise((resolver) => setTimeout(resolver, 500));
        return respuestaGemini(JSON.stringify(analisisValido));
      }),
    );

    const proveedor = new GeminiProvider({ apiKey: 'test-key', timeoutMs: 1 });

    await expect(
      proveedor.analizarDanos({ imagenes: [], codigosPiezasValidos: [] }),
    ).rejects.toMatchObject({ code: 'IA_NO_DISPONIBLE' });
  });

  it('la respuesta sin texto → reintento y luego AiInvalidResponseError', async () => {
    let llamadas = 0;
    server.use(
      http.post('https://generativelanguage.googleapis.com/v1beta/models/:model', () => {
        llamadas += 1;
        return HttpResponse.json({ candidates: [] });
      }),
    );

    const proveedor = new GeminiProvider({ apiKey: 'test-key' });

    await expect(
      proveedor.analizarDanos({ imagenes: [], codigosPiezasValidos: [] }),
    ).rejects.toBeInstanceOf(AiInvalidResponseError);
    expect(llamadas).toBe(2);
  });
});
