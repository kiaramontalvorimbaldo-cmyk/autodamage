import { EDAD_MAX_CAPTURA_MIN } from '@/domain/config';
import type { VerdictFraude } from '@/domain/types';

export type BandasFraude = {
  /** Señal de la IA: patrones de moiré, bordes de pantalla, reflejos de monitor. */
  sospechaRecaptura: boolean;
  /** dHash: la misma foto (o casi) apareció en otro siniestro. */
  fotoDuplicada: boolean;
  /** GPS de la foto muy lejos de la ubicación declarada. */
  inconsistenciaGps: boolean;
  /** Captura demasiado vieja o futura respecto a la recepción. */
  inconsistenciaTemporal: boolean;
};

export type ResultadoVerdict = {
  verdict: VerdictFraude;
  /** Todas las banderas que aplican, en orden de prioridad. */
  indicadores: VerdictFraude[];
};

/**
 * Combina las banderas de fraude en un veredicto.
 * Prioridad: SOSPECHA_RECAPTURA > FOTO_DUPLICADA >
 *            INCONSISTENCIA_GPS > INCONSISTENCIA_TEMPORAL > SIN_RIESGO.
 * `indicadores` lista TODAS las que aplican.
 */
export function calcularVerdictFraude(bandas: BandasFraude): ResultadoVerdict {
  const indicadores: VerdictFraude[] = [];
  if (bandas.sospechaRecaptura) indicadores.push('SOSPECHA_RECAPTURA');
  if (bandas.fotoDuplicada) indicadores.push('FOTO_DUPLICADA');
  if (bandas.inconsistenciaGps) indicadores.push('INCONSISTENCIA_GPS');
  if (bandas.inconsistenciaTemporal) indicadores.push('INCONSISTENCIA_TEMPORAL');

  return {
    verdict: indicadores[0] ?? 'SIN_RIESGO',
    indicadores,
  };
}

/**
 * Inconsistencia temporal: la captura es más vieja que
 * EDAD_MAX_CAPTURA_MIN minutos, o es posterior a la recepción
 * (con +1 min de tolerancia de reloj).
 */
export function esCapturaInconsistente(capturadaEn: Date, recibidaEn: Date): boolean {
  const toleranciaMs = 60_000;
  const edadMaximaMs = EDAD_MAX_CAPTURA_MIN * 60_000;
  const diferencia = recibidaEn.getTime() - capturadaEn.getTime();

  if (diferencia > edadMaximaMs) return true; // captura muy vieja
  if (diferencia < -toleranciaMs) return true; // captura futura (más allá de la tolerancia)
  return false;
}
