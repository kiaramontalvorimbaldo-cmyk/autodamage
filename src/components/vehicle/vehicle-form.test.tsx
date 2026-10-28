import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VehicleForm } from './vehicle-form';

async function enviarVacio() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Guardar vehículo' }));
}

describe('VehicleForm', () => {
  it('muestra los cuatro campos con su etiqueta', () => {
    render(<VehicleForm alGuardar={vi.fn()} />);

    expect(screen.getByLabelText('Matrícula')).toBeInTheDocument();
    expect(screen.getByLabelText('Marca')).toBeInTheDocument();
    expect(screen.getByLabelText('Modelo')).toBeInTheDocument();
    expect(screen.getByLabelText('Número de póliza')).toBeInTheDocument();
  });

  it('exige los campos obligatorios con mensajes por campo', async () => {
    const alGuardar = vi.fn();
    render(<VehicleForm alGuardar={alGuardar} />);

    await enviarVacio();

    expect(await screen.findByText('La matrícula es obligatoria')).toBeInTheDocument();
    expect(screen.getByText('La marca es obligatoria')).toBeInTheDocument();
    expect(screen.getByText('El modelo es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('El número de póliza es obligatorio')).toBeInTheDocument();
    expect(alGuardar).not.toHaveBeenCalled();
  });

  it('convierte la matrícula a mayúsculas mientras se escribe', async () => {
    const user = userEvent.setup();
    render(<VehicleForm alGuardar={vi.fn()} />);

    const matricula = screen.getByLabelText('Matrícula');
    await user.type(matricula, 'pba 1234');

    await waitFor(() => expect(matricula).toHaveValue('PBA 1234'));
  });

  it('envía los datos capturados ya normalizados', async () => {
    const alGuardar = vi.fn();
    const user = userEvent.setup();
    render(<VehicleForm alGuardar={alGuardar} />);

    await user.type(screen.getByLabelText('Matrícula'), ' pba-1234 ');
    await user.type(screen.getByLabelText('Marca'), 'Toyota');
    await user.type(screen.getByLabelText('Modelo'), 'Corolla');
    await user.type(screen.getByLabelText('Número de póliza'), 'pol-001');
    await user.click(screen.getByRole('button', { name: 'Guardar vehículo' }));

    await waitFor(() =>
      expect(alGuardar).toHaveBeenCalledWith(
        {
          matricula: 'PBA-1234',
          marca: 'Toyota',
          modelo: 'Corolla',
          numero_poliza: 'pol-001',
        },
        expect.anything(),
      ),
    );
  });

  it('prellena los valores iniciales al editar', () => {
    render(
      <VehicleForm
        alGuardar={vi.fn()}
        valoresIniciales={{ matricula: 'PBA1234', marca: 'Kia', modelo: 'Rio', numero_poliza: 'p-9' }}
      />,
    );

    expect(screen.getByLabelText('Matrícula')).toHaveValue('PBA1234');
    expect(screen.getByLabelText('Marca')).toHaveValue('Kia');
  });

  it('deshabilita el botón y muestra "Guardando…" durante el envío', () => {
    render(<VehicleForm alGuardar={vi.fn()} guardando />);

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Guardando tus datos…');
  });
});