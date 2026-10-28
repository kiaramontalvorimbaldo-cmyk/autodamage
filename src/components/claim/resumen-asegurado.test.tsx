import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResumenAsegurado } from './resumen-asegurado';

describe('ResumenAsegurado', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra el error de API en lugar de quedarse cargando', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    render(<ResumenAsegurado />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.',
    );
    expect(screen.queryByText('Cargando tu resumen…')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
