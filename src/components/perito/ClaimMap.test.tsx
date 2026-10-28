import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClaimMap } from './ClaimMap';

vi.mock('leaflet', () => ({ default: { icon: vi.fn(() => ({})) } }));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TileLayer: () => null,
}));

describe('ClaimMap', () => {
  it('renderiza las ubicaciones dentro del contenedor del mapa', () => {
    render(
      <ClaimMap
        centro={[-12.0464, -77.0428]}
        puntos={[{ latitud: -12.05, longitud: -77.04, etiqueta: 'Foto 1' }]}
      />,
    );

    const mapa = screen.getByTestId('map-container');
    expect(mapa).toHaveTextContent('Ubicación declarada del siniestro');
    expect(mapa).toHaveTextContent('Foto 1');
  });
});
