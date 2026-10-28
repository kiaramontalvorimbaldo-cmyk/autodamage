import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PartsTable } from './PartsTable';
import { sumarCostos } from '@/lib/piezas-vista';
import type { PiezaVista } from '@/lib/piezas-vista';

const PIEZAS: PiezaVista[] = [
  {
    evaluacionId: 'ev-1',
    codigoPieza: 'FARO_DEL_IZQ',
    accionRequerida: 'SUSTITUIR',
    costoPiezaEstimado: 150,
    confianza: 0.9,
    bbox: [100, 200, 300, 400],
    aprobadoPorPerito: true,
    observacionPieza: null,
  },
  {
    evaluacionId: 'ev-2',
    codigoPieza: 'PUERTA_DEL_IZQ',
    accionRequerida: 'REPARAR',
    costoPiezaEstimado: 105,
    confianza: 0.8,
    bbox: [0, 0, 500, 500],
    aprobadoPorPerito: true,
    observacionPieza: null,
  },
];

describe('sumarCostos', () => {
  it('debería sumar los costos de las piezas', () => {
    expect(sumarCostos(PIEZAS)).toBe(255);
  });

  it('debería devolver 0 sin piezas', () => {
    expect(sumarCostos([])).toBe(0);
  });

  it('debería redondear a 2 decimales', () => {
    expect(
      sumarCostos([
        {
          ...PIEZAS[0],
          costoPiezaEstimado: 33.333,
        },
      ]),
    ).toBe(33.33);
  });
});

describe('PartsTable', () => {
  it('debería renderizar una fila por pieza', () => {
    render(<PartsTable piezas={PIEZAS} onChange={() => undefined} />);
    expect(screen.getByText('FARO_DEL_IZQ')).toBeInTheDocument();
    expect(screen.getByText('PUERTA_DEL_IZQ')).toBeInTheDocument();
  });

  it('debería cambiar la acción de una pieza', () => {
    const onChange = vi.fn();
    render(<PartsTable piezas={PIEZAS} onChange={onChange} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'PINTAR' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const actualizadas = onChange.mock.calls[0][0];
    expect(actualizadas[0].accionRequerida).toBe('PINTAR');
    expect(actualizadas[1].accionRequerida).toBe('REPARAR');
  });

  it('debería cambiar el costo de una pieza', () => {
    const onChange = vi.fn();
    render(<PartsTable piezas={PIEZAS} onChange={onChange} />);

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '200.5' } });

    const actualizadas = onChange.mock.calls[0][0];
    expect(actualizadas[0].costoPiezaEstimado).toBe(200.5);
  });

  it('debería aprobar/desaprobar una pieza', () => {
    const onChange = vi.fn();
    render(<PartsTable piezas={PIEZAS} onChange={onChange} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    const actualizadas = onChange.mock.calls[0][0];
    expect(actualizadas[1].aprobadoPorPerito).toBe(false);
    expect(actualizadas[0].aprobadoPorPerito).toBe(true);
  });

  it('debería editar la observación de una pieza', () => {
    const onChange = vi.fn();
    render(<PartsTable piezas={PIEZAS} onChange={onChange} />);

    const textos = screen.getAllByRole('textbox');
    fireEvent.change(textos[0], {
      target: { value: 'Faro agrietado' },
    });

    const actualizadas = onChange.mock.calls[0][0];
    expect(actualizadas[0].observacionPieza).toBe('Faro agrietado');
  });

  it('debería mostrar la confianza como porcentaje', () => {
    render(<PartsTable piezas={PIEZAS} onChange={() => undefined} />);
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});
