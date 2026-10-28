import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCamera } from './useCamera';

function streamFalso(pista: { stop: Mock }) {
  return {
    getTracks: () => [pista],
  } as unknown as MediaStream;
}

describe('useCamera', () => {
  let getUserMediaMock: Mock;

  beforeEach(() => {
    getUserMediaMock = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debería cerrar un stream que llega después de desmontar', async () => {
    let completar!: (stream: MediaStream) => void;
    getUserMediaMock.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        completar = resolve;
      }),
    );
    const pista = { stop: vi.fn() };
    const { result, unmount } = renderHook(() => useCamera());
    const pendiente = result.current.activar();
    unmount();
    await act(async () => {
      completar(streamFalso(pista));
      await pendiente;
    });
    expect(pista.stop).toHaveBeenCalledOnce();
  });

  it('debería cerrar las pistas si el video no puede reproducirse', async () => {
    const pista = { stop: vi.fn() };
    getUserMediaMock.mockResolvedValue(streamFalso(pista));
    const { result } = renderHook(() => useCamera());
    result.current.videoRef.current = {
      play: vi.fn().mockRejectedValue(new Error('reproducción fallida')),
    } as unknown as HTMLVideoElement;
    await act(async () => {
      await result.current.activar();
    });
    expect(pista.stop).toHaveBeenCalledOnce();
    expect(result.current.activa).toBe(false);
    expect(result.current.error).toBe('DESCONOCIDO');
  });

  it('debería activar la cámara y exponer el stream', async () => {
    const pista = { stop: vi.fn() };
    getUserMediaMock.mockResolvedValue(streamFalso(pista));

    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.activar();
    });

    expect(getUserMediaMock).toHaveBeenCalledWith({
      video: { facingMode: 'environment' },
      audio: false,
    });
    expect(result.current.activa).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('debería reportar SIN_PERMISO cuando el usuario deniega', async () => {
    getUserMediaMock.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.activar();
    });
    expect(result.current.error).toBe('SIN_PERMISO');
    expect(result.current.activa).toBe(false);
  });

  it('debería reportar SIN_CAMARA cuando no hay dispositivo', async () => {
    getUserMediaMock.mockRejectedValue(new DOMException('not found', 'NotFoundError'));
    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.activar();
    });
    expect(result.current.error).toBe('SIN_CAMARA');
  });

  it('debería reportar NO_DISPONIBLE sin mediaDevices', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    });
    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.activar();
    });
    expect(result.current.error).toBe('NO_DISPONIBLE');
  });

  it('debería detener las pistas al desmontar', async () => {
    const pista = { stop: vi.fn() };
    getUserMediaMock.mockResolvedValue(streamFalso(pista));

    const { result, unmount } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.activar();
    });
    unmount();
    expect(pista.stop).toHaveBeenCalled();
  });

  it('debería detener las pistas al llamar detener()', async () => {
    const pista = { stop: vi.fn() };
    getUserMediaMock.mockResolvedValue(streamFalso(pista));

    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.activar();
    });
    act(() => {
      result.current.detener();
    });
    expect(pista.stop).toHaveBeenCalledTimes(1);
    expect(result.current.activa).toBe(false);
  });

  it('debería capturar un fotograma en un canvas', async () => {
    getUserMediaMock.mockResolvedValue(streamFalso({ stop: vi.fn() }));
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);

    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.activar();
    });
    // Simular un video con dimensiones.
    const video = document.createElement('video');
    Object.defineProperty(video, 'videoWidth', { value: 640 });
    Object.defineProperty(video, 'videoHeight', { value: 480 });
    result.current.videoRef.current = video;

    const canvas = result.current.capturar();
    expect(canvas).not.toBeNull();
    expect(canvas?.width).toBe(640);
    expect(canvas?.height).toBe(480);
    expect(drawImage).toHaveBeenCalled();
  });

  it('debería devolver null al capturar sin video activo', () => {
    const { result } = renderHook(() => useCamera());
    expect(result.current.capturar()).toBeNull();
  });
});
