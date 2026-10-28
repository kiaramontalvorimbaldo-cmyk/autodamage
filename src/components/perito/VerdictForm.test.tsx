import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VerdictForm } from './VerdictForm';

describe('VerdictForm', () => {
  it('debería enviar el dictamen aprobado por defecto', async () => {
    const onSubmit = vi.fn();
    render(<VerdictForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /registrar dictamen/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        dictamenFinal: 'APROBADO',
        observacionesPerito: null,
        kilometraje: null,
      });
    });
  });

  it('debería enviar el kilometraje cuando se indica', async () => {
    const onSubmit = vi.fn();
    render(<VerdictForm onSubmit={onSubmit} />);

    const km = screen.getByLabelText(/kilometraje/i);
    fireEvent.change(km, { target: { value: '45230' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar dictamen/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ kilometraje: 45230 }));
    });
  });

  it('debería RECHAZAR sin observaciones (validación)', async () => {
    const onSubmit = vi.fn();
    render(<VerdictForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByLabelText(/rechazar/i));
    fireEvent.click(screen.getByRole('button', { name: /registrar dictamen/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/motivo del rechazo/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('debería permitir rechazar CON observaciones', async () => {
    const onSubmit = vi.fn();
    render(<VerdictForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByLabelText(/rechazar/i));
    fireEvent.change(screen.getByLabelText(/observaciones/i), {
      target: { value: 'No hay daños visibles' },
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar dictamen/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        dictamenFinal: 'RECHAZADO',
        observacionesPerito: 'No hay daños visibles',
        kilometraje: null,
      });
    });
  });

  it('debería requerir instrucciones para enviar AMPLIACION_REQUERIDA', async () => {
    const onSubmit = vi.fn();
    render(<VerdictForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByLabelText(/solicitar ampliación/i));
    fireEvent.click(screen.getByRole('button', { name: /registrar dictamen/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/observaciones/i), {
      target: { value: 'Necesito fotos del lateral' },
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar dictamen/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          dictamenFinal: 'AMPLIACION_REQUERIDA',
        }),
      );
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('debería limpiar el error al corregir', async () => {
    const onSubmit = vi.fn();
    render(<VerdictForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByLabelText(/rechazar/i));
    fireEvent.click(screen.getByRole('button', { name: /registrar dictamen/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/observaciones/i), {
      target: { value: 'Observación de rechazo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar dictamen/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
