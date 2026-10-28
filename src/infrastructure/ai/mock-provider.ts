import {
  AiInvalidResponseError,
  AiUnavailableError,
  type AiProvider,
  type AnalisisIA,
  type InputAnalisis,
} from '@/application/ports/ai-provider';
import { getEnv } from '@/lib/env';
import type { EscenarioMock } from './escenarios-mock';
import { ESCENARIOS_MOCK } from './escenarios-mock';

/**
 * Proveedor simulado: devuelve respuestas fijas de
 * tests/fixtures/ai-responses/ según un escenario configurable.
 * Útil para pruebas y desarrollo sin consumir cuota de Gemini.
 */
export class MockProvider implements AiProvider {
  readonly versionPrompt = 'mock-v1';
  private readonly escenario: EscenarioMock;

  constructor(escenario?: EscenarioMock) {
    const envEscenario =
      typeof process !== 'undefined'
        ? (process.env.MOCK_AI_SCENARIO as EscenarioMock | undefined)
        : undefined;
    this.escenario = escenario ?? envEscenario ?? 'leve-faro';
  }

  async analizarDanos(_input: InputAnalisis): Promise<AnalisisIA> {
    if (this.escenario === 'cuota-agotada') {
      throw new AiUnavailableError('CUOTA_AGOTADA', 'Cuota agotada (simulada)');
    }
    if (this.escenario === 'json-invalido') {
      throw new AiInvalidResponseError('JSON inválido (simulado)');
    }

    const analisis = ESCENARIOS_MOCK[this.escenario];
    // El modelo y el prompt usados se registran en la inspección.
    void getEnv().GEMINI_MODEL;
    return analisis as AnalisisIA;
  }
}
