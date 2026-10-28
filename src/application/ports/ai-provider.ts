import type { Accion, Severidad } from '@/domain/types';
import { AppError } from '@/lib/errors';

/**
 * Error cuando la IA no está disponible (cuota agotada, 5xx, timeout).
 * El caso de uso degrada el análisis: ruta AMARILLA + IA_NO_DISPONIBLE.
 */
export class AiUnavailableError extends AppError {
  constructor(code = 'IA_NO_DISPONIBLE', message = 'La IA no está disponible en este momento') {
    super(code, 503, message);
    this.name = 'AiUnavailableError';
  }
}

/**
 * Error cuando la respuesta de la IA no cumple el esquema
 * (JSON inválido o campos fuera de rango).
 */
export class AiInvalidResponseError extends AppError {
  constructor(message = 'La respuesta de la IA no es válida') {
    super('RESPUESTA_IA_INVALIDA', 502, message);
    this.name = 'AiInvalidResponseError';
  }
}

export type ImagenAnalisis = {
  base64: string;
  mimeType: 'image/jpeg';
};

export type InputAnalisis = {
  imagenes: ImagenAnalisis[];
  codigosPiezasValidos: string[];
  contextoVehiculo?: { marca?: string; modelo?: string };
};

export type PiezaDetectadaIA = {
  codigo_pieza: string;
  accion: Accion;
  evidencia_visible?: string;
  confianza: number;
  imagen_indice: number;
  /** [ymin, xmin, ymax, xmax] normalizado 0–1000 */
  bbox: [number, number, number, number];
};

export type AnalisisIA = {
  vehiculo: { marca: string | null; modelo: string | null };
  piezas_detectadas: PiezaDetectadaIA[];
  nivel_severidad: Severidad;
  indicadores_estructurales: {
    dano_estructural: boolean;
    airbags: boolean;
    perdida_total: boolean;
  };
  sospecha_recaptura: boolean;
  motivo_recaptura: string | null;
  confianza_global: number;
};

/**
 * Puerto del proveedor de IA (patrón Strategy).
 * Implementaciones: GeminiProvider (real) y MockProvider (pruebas).
 */
export interface AiProvider {
  /** Versión del prompt usada por este proveedor (se registra en la inspección). */
  readonly versionPrompt: string;
  analizarDanos(input: InputAnalisis): Promise<AnalisisIA>;
}
