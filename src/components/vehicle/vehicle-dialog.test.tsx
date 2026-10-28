import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VehicleDialog } from './vehicle-dialog';
import type { Vehiculo } from '@/domain/entities';

const VEHICULO: Vehiculo = {
  id: 'veh-9',
  aseguradoId: 'ase-1',
  matricula: 'PBA1234',
  marca: 'Toyota',
  modelo: 'Corolla',
  numeroPoliza: 'POL-9',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VehicleDialog', () => {
  it('registra el vehículo, avisa y entrega el resultado al padre', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(VEHICULO), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const alGuardar = vi.fn();
    const alCambiarAbierto = vi.fn();
    const user = userEvent.setup();

    render(
      <VehicleDialog abierto alCambiarAbierto={alCambiarAbierto} alGuardar={alGuardar} />,
    );

    await user.type(screen.getByLabelText('Matrícula'), 'pba-1234');
    await user.type(screen.getByLabelText('Marca'), 'Toyota');
    await user.type(screen.getByLabelText('Modelo'), 'Corolla');
    await user.type(screen.getByLabelText('Número de póliza'), 'POL-9');
    await user.click(screen.getByRole('button', { name: 'Registrar vehículo' }));

    await waitFor(() => expect(alGuardar).toHaveBeenCalledWith(VEHICULO));
    expect(alCambiarAbierto).toHaveBeenCalledWith(false);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/vehiculos',
      expect.objectContaining({ method: 'POST' }),
    );

    vi.unstubAllGlobals();
  });
});