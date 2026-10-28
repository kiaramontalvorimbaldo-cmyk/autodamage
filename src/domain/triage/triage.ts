import { CONFIANZA_MINIMA, COSTO_LIMITE_VERDE_USD } from '@/domain/config';
import type { Etiqueta, Ruta, Severidad, TipoInspeccion, VerdictFraude } from '@/domain/types';

export type Estructurales = {
  danoEstructural: boolean;
  airbags: boolean;
  perdidaTotal: boolean;
};

export type TriageInput = {
  severidad: Severidad;
  estructurales: Estructurales;
  costoTotalUsd: number;
  verdictFraude: VerdictFraude;
  confianzaGlobal: number;
  iaDisponible: boolean;
  piezasValidas: number;
};

export type TriageResult = {
  ruta: Ruta;
  estado: 'FAST_TRACK' | 'EN_REVISION';
  tipoInspeccion: TipoInspeccion;
  requiereInspeccionPresencial: boolean;
  etiquetas: Etiqueta[];
  razones: string[];
};

/**
 * Reglas de triaje (la primera regla que aplique gana):
 * 1. ROJA: estructural, airbags, pérdida total, SEVERO o fraude → EN_REVISION + PRESENCIAL.
 * 2. AMARILLA: IA no disponible, 0 piezas válidas, baja confianza o MODERADO.
 * 3. VERDE: LEVE y costo < 500 USD y sin fraude → FAST_TRACK.
 * 4. AMARILLA: ante la duda, decide un humano.
 */
export function triage(input: TriageInput, requiereNuevoDictamen = false): TriageResult {
  const {
    severidad,
    estructurales,
    costoTotalUsd,
    verdictFraude,
    confianzaGlobal,
    iaDisponible,
    piezasValidas,
  } = input;

  // --- 1. ROJA ---
  const razonesRojas: string[] = [];
  if (estructurales.danoEstructural) razonesRojas.push('daño estructural detectado');
  if (estructurales.airbags) razonesRojas.push('airbags desplegados');
  if (estructurales.perdidaTotal) razonesRojas.push('pérdida total');
  if (severidad === 'SEVERO') razonesRojas.push('severidad SEVERA');
  if (verdictFraude !== 'SIN_RIESGO') razonesRojas.push(`riesgo de fraude: ${verdictFraude}`);

  if (razonesRojas.length > 0) {
    return {
      ruta: 'ROJA',
      estado: 'EN_REVISION',
      tipoInspeccion: 'PRESENCIAL',
      requiereInspeccionPresencial: true,
      etiquetas: [],
      razones: razonesRojas,
    };
  }

  // --- 2. AMARILLA por degradación o duda moderada ---
  const etiquetas: Etiqueta[] = [];
  const razones: string[] = [];
  if (!iaDisponible) {
    etiquetas.push('IA_NO_DISPONIBLE');
    razones.push('la IA no está disponible');
  }
  if (piezasValidas === 0) {
    etiquetas.push('SIN_PIEZAS_VALIDAS');
    razones.push('no hay piezas válidas del baremo');
  }
  if (confianzaGlobal < CONFIANZA_MINIMA) {
    etiquetas.push('BAJA_CONFIANZA');
    razones.push(`confianza global ${confianzaGlobal} inferior a ${CONFIANZA_MINIMA}`);
  }
  if (severidad === 'MODERADO') {
    razones.push('severidad MODERADA');
  }

  if (etiquetas.length > 0 || severidad === 'MODERADO') {
    return {
      ruta: 'AMARILLA',
      estado: 'EN_REVISION',
      tipoInspeccion: 'DIGITAL_IA',
      requiereInspeccionPresencial: false,
      etiquetas,
      razones,
    };
  }

  // --- 3. VERDE ---
  if (
    severidad === 'LEVE' &&
    costoTotalUsd < COSTO_LIMITE_VERDE_USD &&
    verdictFraude === 'SIN_RIESGO'
  ) {
    return {
      ruta: requiereNuevoDictamen ? 'AMARILLA' : 'VERDE',
      estado: requiereNuevoDictamen ? 'EN_REVISION' : 'FAST_TRACK',
      tipoInspeccion: 'DIGITAL_IA',
      requiereInspeccionPresencial: false,
      etiquetas,
      razones: requiereNuevoDictamen
        ? ['la ampliación requiere un nuevo dictamen del perito']
        : ['daño leve, costo menor a 500 USD y sin indicios de fraude'],
    };
  }

  // --- 4. AMARILLA por defecto ---
  razones.push('caso dudoso: lo decide un perito');
  return {
    ruta: 'AMARILLA',
    estado: 'EN_REVISION',
    tipoInspeccion: 'DIGITAL_IA',
    requiereInspeccionPresencial: false,
    etiquetas,
    razones,
  };
}
