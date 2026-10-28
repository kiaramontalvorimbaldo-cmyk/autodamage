import type { AnalisisIA } from '@/application/ports/ai-provider';
import leveFaro from '../../../tests/fixtures/ai-responses/leve-faro.json';
import moderadoPuerta from '../../../tests/fixtures/ai-responses/moderado-puerta.json';
import severoEstructural from '../../../tests/fixtures/ai-responses/severo-estructural.json';
import recaptura from '../../../tests/fixtures/ai-responses/recaptura.json';
import bajaConfianza from '../../../tests/fixtures/ai-responses/baja-confianza.json';
import sinPiezas from '../../../tests/fixtures/ai-responses/sin-piezas.json';

/**
 * Escenarios disponibles del MockProvider.
 * Los escenarios "json-invalido" y "cuota-agotada" se
 * simulan lanzando los errores correspondientes.
 */
export type EscenarioMock =
  | 'leve-faro'
  | 'moderado-puerta'
  | 'severo-estructural'
  | 'recaptura'
  | 'baja-confianza'
  | 'sin-piezas'
  | 'json-invalido'
  | 'cuota-agotada';

export const ESCENARIOS_MOCK: Record<
  Exclude<EscenarioMock, 'json-invalido' | 'cuota-agotada'>,
  AnalisisIA
> = {
  'leve-faro': leveFaro as AnalisisIA,
  'moderado-puerta': moderadoPuerta as AnalisisIA,
  'severo-estructural': severoEstructural as AnalisisIA,
  recaptura: recaptura as AnalisisIA,
  'baja-confianza': bajaConfianza as AnalisisIA,
  'sin-piezas': sinPiezas as AnalisisIA,
};
