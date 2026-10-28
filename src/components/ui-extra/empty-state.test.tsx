import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renderiza título y descripción', () => {
    render(<EmptyState titulo="Aún no tienes vehículos" descripcion="Registra tu vehículo para reportar un siniestro." />);

    expect(screen.getByRole('heading', { name: 'Aún no tienes vehículos' })).toBeInTheDocument();
    expect(
      screen.getByText('Registra tu vehículo para reportar un siniestro.'),
    ).toBeInTheDocument();
  });

  it('renderiza la acción opcional', () => {
    render(
      <EmptyState
        titulo="Aún no tienes vehículos"
        descripcion="Registra tu vehículo para reportar un siniestro."
        accion={<button type="button">Registrar vehículo</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Registrar vehículo' })).toBeInTheDocument();
  });

  it('funciona sin descripción ni acción', () => {
    render(<EmptyState titulo="Sin datos" />);

    expect(screen.getByRole('heading', { name: 'Sin datos' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});