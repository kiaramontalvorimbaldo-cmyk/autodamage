import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DamageViewer, escalarCoordenadas } from './DamageViewer';
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
];

describe('escalarCoordenadas', () => {
  it('debería convertir 0–1000 a píxeles (contenedor 800×600)', () => {
    const region = escalarCoordenadas([100, 200, 300, 400], 800, 600);
    // xmin=200/1000*800=160, ymin=100/1000*600=60
    expect(region.x).toBeCloseTo(160);
    expect(region.y).toBeCloseTo(60);
    expect(region.ancho).toBeCloseTo(160); // (400-200)/1000*800
    expect(region.alto).toBeCloseTo(120); // (300-100)/1000*600
  });

  it('debería escalar correctamente para contenedor pequeño (320×240)', () => {
    const region = escalarCoordenadas([0, 0, 1000, 1000], 320, 240);
    expect(region).toEqual({ x: 0, y: 0, ancho: 320, alto: 240 });
  });

  it('debería escalar correctamente para contenedor grande (1920×1080)', () => {
    const region = escalarCoordenadas([250, 250, 750, 750], 1920, 1080);
    expect(region.x).toBeCloseTo(480);
    expect(region.y).toBeCloseTo(270);
    expect(region.ancho).toBeCloseTo(960);
    expect(region.alto).toBeCloseTo(540);
  });

  it('debería manejar caja de un solo punto', () => {
    const region = escalarCoordenadas([500, 500, 500, 500], 1000, 1000);
    expect(region.ancho).toBe(0);
    expect(region.alto).toBe(0);
  });
});

describe('DamageViewer', () => {
  it('debería renderizar la imagen y el SVG de cajas', () => {
    const { container } = render(<DamageViewer imagenUrl="/evidencia.jpg" piezas={PIEZAS} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/evidencia.jpg');
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const rects = svg?.querySelectorAll('rect');
    expect(rects?.length).toBe(1);
  });

  it('debería renderizar sin cajas cuando no hay piezas', () => {
    const { container } = render(<DamageViewer imagenUrl="/evidencia.jpg" piezas={[]} />);
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(0);
  });

  it('debería incluir el nombre de la pieza en la etiqueta accesible', () => {
    const nombres = new Map<string, string>([['FARO_DEL_IZQ', 'Faro delantero izquierdo']]);
    const { container } = render(
      <DamageViewer imagenUrl="/evidencia.jpg" piezas={PIEZAS} nombresPiezas={nombres} />,
    );
    const title = container.querySelector('title');
    expect(title?.textContent).toContain('Faro delantero izquierdo');
    expect(title?.textContent).toContain('SUSTITUIR');
  });

  it('debería renderizar el testid damage-viewer', () => {
    render(<DamageViewer imagenUrl="/evidencia.jpg" piezas={PIEZAS} />);
    expect(screen.getByTestId('damage-viewer')).toBeInTheDocument();
  });
});
