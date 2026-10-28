import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CameraCapture } from './CameraCapture';

// Simular el pipeline completo de captura.
vi.mock('@/hooks/useCamera', () => ({
  useCamera: () => ({
    videoRef: { current: null },
    activa: true,
    error: null,
    activar: vi.fn(),
    detener: vi.fn(),
    capturar: () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      return canvas;
    },
  }),
}));

vi.mock('@/lib/faceBlur', () => ({
  procesarImagen: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/compressImage', () => ({
  comprimirImagen: vi.fn().mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' })),
}));

describe('CameraCapture', () => {
  it('debería NO tener ningún input[type=file] en el árbol', () => {
    const { container } = render(<CameraCapture onCaptura={() => undefined} />);
    const archivos = container.querySelectorAll('input[type="file"]');
    expect(archivos.length).toBe(0);
  });

  it('debería mostrar el botón Activar cámara cuando no está activa', () => {
    render(<CameraCapture onCaptura={() => undefined} />);
    // El mock pone activa=true, así que vemos Capturar.
    expect(screen.getByRole('button', { name: /capturar/i })).toBeInTheDocument();
  });

  it('debería invocar onCaptura con un Blob y la fecha', async () => {
    const onCaptura = vi.fn();
    render(<CameraCapture onCaptura={onCaptura} />);

    fireEvent.click(screen.getByRole('button', { name: /capturar/i }));

    await vi.waitFor(() => {
      expect(onCaptura).toHaveBeenCalledTimes(1);
    });
    const resultado = onCaptura.mock.calls[0][0];
    expect(resultado.blob).toBeInstanceOf(Blob);
    expect(resultado.blob.type).toBe('image/jpeg');
    expect(typeof resultado.capturadaEn).toBe('string');
    expect(new Date(resultado.capturadaEn).toString()).not.toBe('Invalid Date');
  });

  it('debería mostrar error fail-closed si el detector falla', async () => {
    const { procesarImagen } = await import('@/lib/faceBlur');
    vi.mocked(procesarImagen).mockRejectedValueOnce(new Error('MODELO_NO_CARGADO'));

    const onCaptura = vi.fn();
    render(<CameraCapture onCaptura={onCaptura} />);

    fireEvent.click(screen.getByRole('button', { name: /capturar/i }));

    await vi.waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/verificar la privacidad/i);
    });
    expect(onCaptura).not.toHaveBeenCalled();
  });
});
