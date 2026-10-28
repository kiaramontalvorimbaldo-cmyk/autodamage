import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from './useGeolocation';

describe('useGeolocation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('debería obtener la posición de alta precisión', async () => {
    const getCurrentPosition = vi.fn((exito: PositionCallback) => {
      exito({
        coords: {
          latitude: 19.4326,
          longitude: -99.1332,
          accuracy: 12,
        } as GeolocationCoordinates,
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());
    let posicion = null;
    await act(async () => {
      posicion = await result.current.solicitar();
    });

    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 0,
    });
    expect(posicion).toEqual({
      latitud: 19.4326,
      longitud: -99.1332,
      precisionM: 12,
    });
    expect(result.current.posicion).toEqual(posicion);
    expect(result.current.error).toBeNull();
  });

  it('debería reportar SIN_PERMISO al denegar', async () => {
    const getCurrentPosition = vi.fn((_exito: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 1 } as GeolocationPositionError);
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());
    await act(async () => {
      await result.current.solicitar();
    });
    expect(result.current.error).toBe('SIN_PERMISO');
    expect(result.current.posicion).toBeNull();
  });

  it('debería reportar TIMEOUT', async () => {
    const getCurrentPosition = vi.fn((_exito: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 3 } as GeolocationPositionError);
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());
    await act(async () => {
      await result.current.solicitar();
    });
    expect(result.current.error).toBe('TIMEOUT');
  });

  it('debería reportar NO_DISPONIBLE sin geolocation', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      configurable: true,
    });
    const { result } = renderHook(() => useGeolocation());
    await act(async () => {
      await result.current.solicitar();
    });
    expect(result.current.error).toBe('NO_DISPONIBLE');
  });

  it('debería reintentar sin alta precisión si el proveedor GPS no está disponible', async () => {
    const getCurrentPosition = vi.fn(
      (exito: PositionCallback, error: PositionErrorCallback, opciones?: PositionOptions) => {
        if (opciones?.enableHighAccuracy) error({ code: 2 } as GeolocationPositionError);
        else
          exito({
            coords: { latitude: -16.5, longitude: -68.15, accuracy: 500 },
          } as GeolocationPosition);
      },
    );
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });
    const { result } = renderHook(() => useGeolocation());
    await act(async () => {
      await result.current.solicitar();
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(result.current.posicion?.precisionM).toBe(500);
    expect(result.current.error).toBeNull();
  });

  it('debería explicar ubicación no disponible tras ambos intentos', async () => {
    const getCurrentPosition = vi.fn((_exito: PositionCallback, error: PositionErrorCallback) =>
      error({ code: 2 } as GeolocationPositionError),
    );
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });
    const { result } = renderHook(() => useGeolocation());
    await act(async () => {
      await result.current.solicitar();
    });
    expect(result.current.error).toBe('NO_DISPONIBLE');
  });
});
