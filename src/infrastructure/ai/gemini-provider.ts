import { GoogleGenAI } from '@google/genai';
import {
  AiInvalidResponseError,
  AiUnavailableError,
  type AiProvider,
  type AnalisisIA,
  type InputAnalisis,
} from '@/application/ports/ai-provider';
import { getEnv } from '@/lib/env';
import { analisisIaSchema, analisisIaJsonSchema } from './ai-schema';
import { VERSION_PROMPT, construirPromptV1 } from './prompt-v1';

const TIMEOUT_MS_POR_DEFECTO = 25_000;

/** Marca interna: la respuesta de la IA no se pudo interpretar (reintentable). */
class ErrorDeRespuestaIa extends Error {}

function esCuotaAgotada(error: unknown): boolean {
  const status = extraerStatus(error);
  if (status === 429) return true;
  const mensaje = mensajeDeError(error);
  return /quota|rate[\s-]?limit|too many requests|\b429\b/i.test(mensaje);
}

function esErrorServidor(error: unknown): boolean {
  const status = extraerStatus(error);
  return status !== undefined && status >= 500;
}

function esTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; cause?: unknown };
  if (e.name === 'AbortError') return true;
  const mensaje = mensajeDeError(error);
  if (/abort|timeout|timed out|deadline exceeded/i.test(mensaje)) return true;
  if (e.cause && e.cause !== error) return esTimeout(e.cause);
  return false;
}

function extraerStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const candidato = error as { status?: unknown; statusCode?: unknown; code?: unknown };
    if (typeof candidato.status === 'number') return candidato.status;
    if (typeof candidato.statusCode === 'number') return candidato.statusCode;
    if (typeof candidato.code === 'number') return candidato.code;
  }
  return undefined;
}

function mensajeDeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Proveedor real de IA: Google Gemini vía Google AI Studio.
 *
 * - Envía TODAS las imágenes del siniestro en una sola solicitud.
 * - Valida la respuesta con Zod. JSON inválido o error 5xx: UN reintento.
 * - Error 429 o cuota agotada: SIN reintento → AiUnavailableError('CUOTA_AGOTADA').
 * - Timeout de 25 s (configurable).
 */
export class GeminiProvider implements AiProvider {
  readonly versionPrompt = VERSION_PROMPT;
  private readonly genai: GoogleGenAI;
  private readonly timeoutMs: number;

  constructor(opciones: { timeoutMs?: number; apiKey?: string } = {}) {
    this.timeoutMs = opciones.timeoutMs ?? TIMEOUT_MS_POR_DEFECTO;
    this.genai = new GoogleGenAI({
      apiKey: opciones.apiKey ?? getEnv().GEMINI_API_KEY,
    });
  }

  async analizarDanos(input: InputAnalisis): Promise<AnalisisIA> {
    try {
      return await this.intento(input);
    } catch (error) {
      if (error instanceof AiUnavailableError || error instanceof AiInvalidResponseError) {
        throw error;
      }
      if (esCuotaAgotada(error)) {
        throw new AiUnavailableError('CUOTA_AGOTADA', 'La cuota de la IA está agotada (429)');
      }
      if (esTimeout(error)) {
        throw new AiUnavailableError('IA_NO_DISPONIBLE', 'La IA no respondió a tiempo');
      }
      if (error instanceof ErrorDeRespuestaIa || esErrorServidor(error)) {
        // JSON inválido o error 5xx: un solo reintento
        try {
          return await this.intento(input);
        } catch (errorReintento) {
          if (errorReintento instanceof AiInvalidResponseError) throw errorReintento;
          if (esCuotaAgotada(errorReintento)) {
            throw new AiUnavailableError('CUOTA_AGOTADA', 'La cuota de la IA está agotada (429)');
          }
          if (errorReintento instanceof ErrorDeRespuestaIa) {
            throw new AiInvalidResponseError(
              'La respuesta de la IA no cumple el esquema después de un reintento',
            );
          }
          throw new AiUnavailableError('IA_NO_DISPONIBLE', 'La IA falló después de un reintento');
        }
      }
      throw new AiUnavailableError('IA_NO_DISPONIBLE', 'Error inesperado al contactar la IA');
    }
  }

  private async intento(input: InputAnalisis): Promise<AnalisisIA> {
    const env = getEnv();
    const partes = [
      ...input.imagenes.map((imagen) => ({
        inlineData: { data: imagen.base64, mimeType: imagen.mimeType },
      })),
      { text: construirPromptV1(input.codigosPiezasValidos, input.contextoVehiculo) },
    ];

    const respuesta = await this.genai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: [{ role: 'user', parts: partes }],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: analisisIaJsonSchema,
        temperature: 0,
        // Sin reintentos internos del SDK: el proveedor
        // aplica sus propias reglas de reintento.
        httpOptions: {
          timeout: this.timeoutMs,
          retryOptions: { attempts: 1 },
        },
      },
    });

    const texto = respuesta.text;
    if (!texto) {
      throw new ErrorDeRespuestaIa('La IA no devolvió texto');
    }

    let crudo: unknown;
    try {
      crudo = JSON.parse(texto);
    } catch {
      throw new ErrorDeRespuestaIa('La IA devolvió JSON inválido');
    }

    const parseado = analisisIaSchema.safeParse(crudo);
    if (!parseado.success) {
      const detalles = parseado.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new ErrorDeRespuestaIa(`La respuesta no cumple el esquema: ${detalles}`);
    }

    if (
      parseado.data.piezas_detectadas.some((pieza) => pieza.imagen_indice >= input.imagenes.length)
    ) {
      throw new ErrorDeRespuestaIa('La respuesta referencia una imagen que no fue enviada');
    }

    return parseado.data;
  }
}
