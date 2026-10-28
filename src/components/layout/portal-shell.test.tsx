import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortalShell } from './portal-shell';

const usePathname = vi.fn();
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
  useRouter: () => ({ push: replace, refresh: vi.fn(), back: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  usePathname.mockReturnValue('/asegurado');
});

describe('PortalShell', () => {
  it('muestra los ítems del asegurado', () => {
    render(
      <PortalShell rol="ASEGURADO" nombre="kiara montalvo">
        <p>contenido</p>
      </PortalShell>,
    );

    for (const etiqueta of ['Inicio', 'Reportar siniestro', 'Mis siniestros', 'Mis vehículos']) {
      expect(screen.getAllByRole('link', { name: new RegExp(etiqueta) }).length).toBeGreaterThan(0);
    }
  });

  it('no muestra los ítems de otros roles', () => {
    render(
      <PortalShell rol="PERITO" nombre="ana ruiz">
        <p>contenido</p>
      </PortalShell>,
    );

    expect(screen.queryByRole('link', { name: /Mis vehículos/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Reportar siniestro/ })).toBeNull();
  });

  it('resalta el ítem activo con aria-current', () => {
    usePathname.mockReturnValue('/asegurado/siniestros');
    render(
      <PortalShell rol="ASEGURADO" nombre="kiara montalvo">
        <p>contenido</p>
      </PortalShell>,
    );

    const activos = screen.getAllByRole('link', { current: 'page' });
    expect(activos.length).toBeGreaterThan(0);
    for (const activo of activos) {
      expect(activo.getAttribute('href')).toBe('/asegurado/siniestros');
    }
  });

  it('no marca nada como activo si la ruta no corresponde a ningún ítem', () => {
    usePathname.mockReturnValue('/asegurado/vehiculos/nuevo');
    render(
      <PortalShell rol="ASEGURADO" nombre="kiara montalvo">
        <p>contenido</p>
      </PortalShell>,
    );

    const activos = screen.queryAllByRole('link', { current: 'page' });
    for (const activo of activos) {
      expect(activo.getAttribute('href')).toBe('/asegurado/vehiculos');
    }
  });

  it('muestra el nombre capitalizado y el rol legible en la cabecera', () => {
    render(
      <PortalShell rol="ASEGURADO" nombre="kiara montalvo">
        <p>contenido</p>
      </PortalShell>,
    );

    expect(screen.getAllByText('Kiara Montalvo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Asegurado').length).toBeGreaterThan(0);
  });

  it('siempre ofrece una salida: cerrar sesión', () => {
    render(
      <PortalShell rol="ASEGURADO" nombre="kiara montalvo">
        <p>contenido</p>
      </PortalShell>,
    );

    expect(screen.getByRole('button', { name: /Cerrar sesión/i })).toBeInTheDocument();
  });

  it('muestra los ítems del taller', () => {
    render(
      <PortalShell rol="TALLER" nombre="taller centro">
        <p>contenido</p>
      </PortalShell>,
    );

    const enlacesOrdenes = screen.getAllByRole('link', { name: /Órdenes de trabajo/ });
    expect(enlacesOrdenes.length).toBeGreaterThan(0);
    expect(enlacesOrdenes[0]).toHaveAttribute('href', '/taller/ordenes');
  });
});
it('debería mostrar el inicio y las herramientas del administrador', () => {
  usePathname.mockReturnValue('/admin');
  render(
    <PortalShell rol="ADMIN" nombre="Ana">
      <p>contenido</p>
    </PortalShell>,
  );
  expect(screen.getAllByRole('link', { name: 'Casos' }).length).toBeGreaterThan(0);
  for (const link of screen.getAllByRole('link', { current: 'page' }))
    expect(link).toHaveAttribute('href', '/admin');
});
