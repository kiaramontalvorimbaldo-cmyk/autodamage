import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AnalysisBasis } from './analysis-basis';
import type { InspeccionPericial } from '@/domain/entities';
describe('fundamento visible del análisis', () => {
  it('debería mostrar evidencia y foto sin afirmar autenticidad', () => {
    const inspeccion = {
      respuestaIa: {
        piezas_detectadas: [
          {
            codigo_pieza: 'FARO',
            accion: 'SUSTITUIR',
            imagen_indice: 1,
            confianza: 0.8,
            evidencia_visible: 'Grieta visible en el lente',
          },
        ],
        sospecha_recaptura: false,
      },
      nivelSeveridad: 'LEVE',
      confianzaGlobal: 0.8,
      costoTotalEstimado: 150,
    } as InspeccionPericial;
    render(<AnalysisBasis inspeccion={inspeccion} />);
    expect(screen.getByText(/Grieta visible/)).toBeInTheDocument();
    expect(screen.getByText(/Foto 2/)).toBeInTheDocument();
    expect(screen.getByText(/no certifica autenticidad/)).toBeInTheDocument();
  });
  it('debería tolerar una respuesta histórica vacía sin inventar observaciones', () => {
    render(
      <AnalysisBasis
        inspeccion={
          {
            respuestaIa: null,
            confianzaGlobal: null,
            costoTotalEstimado: null,
          } as InspeccionPericial
        }
      />,
    );
    expect(screen.getByText(/No hay piezas detectadas/)).toBeInTheDocument();
  });
});
