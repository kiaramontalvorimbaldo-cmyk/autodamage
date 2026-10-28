'use client';

import { useCallback, useState } from 'react';

export type Posicion = { latitud: number; longitud: number; precisionM: number };

export type ErrorGeoloc = 'SIN_PERMISO' | 'NO_DISPONIBLE' | 'TIMEOUT' | 'DESCONOCIDO';

export const MENSAJES_GPS: Record<ErrorGeoloc, string> = {
  SIN_PERMISO:
    'Permite el acceso a la ubicación en el navegador y activa la ubicación del dispositivo.',
  NO_DISPONIBLE:
    'El dispositivo no pudo determinar tu ubicación. Activa la ubicación y vuelve a intentarlo; también puedes indicar el punto en el mapa.',
  TIMEOUT:
    'La ubicación tardó demasiado. Inténtalo de nuevo cerca de una ventana o indica el punto en el mapa.',
  DESCONOCIDO: 'No pudimos obtener tu ubicación. Vuelve a intentarlo o indica el punto en el mapa.',
};

export type UseGeolocationResult = {
  posicion: Posicion | null;
  error: ErrorGeoloc | null;
  cargando: boolean;
  /** Geolocalización de alta precisión con timeout de 10 s. */
  solicitar: () => Promise<Posicion | null>;
};

/**
 * Hook de geolocalización del navegador (alta precisión, timeout 10 s).
 */
export function useGeolocation(): UseGeolocationResult {
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const [error, setError] = useState<ErrorGeoloc | null>(null);
  const [cargando, setCargando] = useState(false);

  const solicitar = useCallback(async (): Promise<Posicion | null> => {
    setError(null);
    if (!navigator.geolocation?.getCurrentPosition) {
      setError('NO_DISPONIBLE');
      return null;
    }
    setCargando(true);
    try {
      const leer = (altaPrecision: boolean) =>
        new Promise<Posicion>((resolver, rechazar) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              resolver({
                latitud: pos.coords.latitude,
                longitud: pos.coords.longitude,
                precisionM: pos.coords.accuracy,
              });
            },
            (err) => {
              // Códigos del estándar: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
              switch (err.code) {
                case 1:
                  rechazar(new Error('SIN_PERMISO'));
                  break;
                case 3:
                  rechazar(new Error('TIMEOUT'));
                  break;
                case 2:
                  rechazar(new Error('NO_DISPONIBLE'));
                  break;
                default:
                  rechazar(new Error('DESCONOCIDO'));
              }
            },
            { enableHighAccuracy: altaPrecision, timeout: 10_000, maximumAge: 0 },
          );
        });
      const resultado = await leer(true).catch((e: unknown) => {
        if (e instanceof Error && (e.message === 'NO_DISPONIBLE' || e.message === 'TIMEOUT'))
          return leer(false);
        throw e;
      });
      setPosicion(resultado);
      return resultado;
    } catch (e) {
      const codigo = e instanceof Error ? e.message : 'DESCONOCIDO';
      setError(
        codigo === 'SIN_PERMISO' ||
          codigo === 'TIMEOUT' ||
          codigo === 'DESCONOCIDO' ||
          codigo === 'NO_DISPONIBLE'
          ? (codigo as ErrorGeoloc)
          : 'DESCONOCIDO',
      );
      return null;
    } finally {
      setCargando(false);
    }
  }, []);

  return { posicion, error, cargando, solicitar };
}
