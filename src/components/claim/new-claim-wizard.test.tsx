import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewClaimWizard } from './new-claim-wizard';
import type { Vehiculo } from '@/domain/entities';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn(), back: vi.fn() }),
}));

// La cámara no es necesaria para las pruebas de navegación del asistente.
vi.mock('@/components/camera/CameraCapture', () => ({
  CameraCapture: () => <div>cámara simulada</div>,
}));

const VEHICULO: Vehiculo = {
  id: 'veh-1',
  aseguradoId: 'ase-1',
  matricula: 'PBA1234',
  marca: 'Toyota',
  modelo: 'Corolla',
  numeroPoliza: 'POL-1',
};

function responderConVehiculos(vehiculos: Vehiculo[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(vehiculos), { status: 200 })),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  responderConVehiculos([VEHICULO]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NewClaimWizard', () => {
  it('muestra los cuatro pasos con el actual resaltado', async () => {
    render(<NewClaimWizard />);

    for (const nombre of ['Vehículo', 'Detalles', 'Fotos', 'Revisar']) {
      expect(screen.getByText(nombre)).toBeInTheDocument();
    }
    expect(await screen.findByText('Paso 1 de 4: Vehículo')).toBeInTheDocument();
    const pasoActual = document.querySelector('[aria-current="step"]');
    expect(pasoActual).toHaveTextContent('Vehículo');
  });

  it('no avanza sin vehículo seleccionado y muestra la ayuda', async () => {
    const user = userEvent.setup();
    render(<NewClaimWizard />);

    await screen.findByRole('button', { name: /PBA1234/ });
    const siguiente = screen.getByRole('button', { name: 'Siguiente' });
    expect(siguiente).toBeDisabled();
    expect(screen.getByText('Selecciona un vehículo para continuar')).toBeInTheDocument();

    await user.click(siguiente);
    expect(screen.queryByText('Paso 2 de 4: Detalles')).not.toBeInTheDocument();
  });

  it('avanza al seleccionar vehículo y conserva los datos al volver atrás', async () => {
    const user = userEvent.setup();
    render(<NewClaimWizard />);

    await user.click(await screen.findByRole('button', { name: /PBA1234/ }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Paso 2 de 4: Detalles')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Descripción'), 'Golpe en el parqueadero');
    await user.click(screen.getByRole('button', { name: 'Atrás' }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByLabelText('Descripción')).toHaveValue('Golpe en el parqueadero');
  });

  it('pide confirmación al cancelar con datos ingresados', async () => {
    const user = userEvent.setup();
    render(<NewClaimWizard />);

    await user.click(await screen.findByRole('button', { name: /PBA1234/ }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('¿Salir del reporte?');
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it('confirma la salida y regresa a la lista', async () => {
    const user = userEvent.setup();
    render(<NewClaimWizard />);

    await user.click(await screen.findByRole('button', { name: /PBA1234/ }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(await screen.findByRole('button', { name: 'Sí, salir' }));

    expect(push).toHaveBeenCalledWith('/asegurado/siniestros');
  });

  it('cancela sin confirmación cuando no hay datos', async () => {
    const user = userEvent.setup();
    render(<NewClaimWizard />);

    await screen.findByRole('button', { name: /PBA1234/ });
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledWith('/asegurado/siniestros');
  });

  it('ofrece registrar un vehículo cuando no hay ninguno', async () => {
    responderConVehiculos([]);
    render(<NewClaimWizard />);

    expect(await screen.findByText('Aún no tienes vehículos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar mi primer vehículo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar otro vehículo' })).toBeInTheDocument();
  });

  it('explica por qué está deshabilitado "Siguiente" cuando faltan datos del incidente', async () => {
    const user = userEvent.setup();
    render(<NewClaimWizard />);

    await user.click(await screen.findByRole('button', { name: /PBA1234/ }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByText('Completa la fecha del incidente para continuar')).toBeInTheDocument();
  });

  it('habilita "Siguiente" cuando la fecha y la ubicación son válidas', async () => {
    const user = userEvent.setup();
    render(<NewClaimWizard />);

    await user.click(await screen.findByRole('button', { name: /PBA1234/ }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    await user.type(screen.getByLabelText('Fecha y hora del incidente'), '2025-01-15T10:30');
    await user.type(screen.getByLabelText('Latitud'), '17.386345932997905');
    await user.type(screen.getByLabelText('Longitud'), '-66.14062325484846');

    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  });
});