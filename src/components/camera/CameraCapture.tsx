'use client';

import { useState } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { procesarImagen } from '@/lib/faceBlur';
import { comprimirImagen } from '@/lib/compressImage';

export type CapturaResult = {
  blob: Blob;
  capturadaEn: string;
};

const MENSAJES_ERROR: Record<string, string> = {
  SIN_PERMISO:
    'Permiso de cámara denegado. Permite el acceso en la barra del navegador e inténtalo de nuevo.',
  SIN_CAMARA: 'No se encontró una cámara en este dispositivo.',
  NO_DISPONIBLE: 'La cámara no está disponible en este navegador.',
  DESCONOCIDO: 'No se pudo acceder a la cámara. Inténtalo de nuevo.',
  ROSTROS_FALLIDO:
    'No se pudo verificar la privacidad de la foto (detector de rostros no disponible). No se enviará la imagen.',
};

/**
 * Captura en vivo con la cámara trasera.
 * - Dibuja el fotograma en canvas.
 * - Difumina rostros (fail-closed: si el detector falla, no se envía).
 * - Comprime a máx. 1280 px y JPEG 0.7 (sin EXIF).
 *
 * Prohibido: no existe ningún <input type="file"> ni selector de galería.
 */
export function CameraCapture({
  onCaptura,
  deshabilitado = false,
}: {
  onCaptura: (resultado: CapturaResult) => void | Promise<void>;
  deshabilitado?: boolean;
}) {
  const { videoRef, activa, error, activar, detener, capturar } = useCamera();
  const [errorProcesamiento, setErrorProcesamiento] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const handleCapturar = async () => {
    setErrorProcesamiento(null);
    setProcesando(true);
    try {
      const canvas = capturar();
      const capturadaEn = new Date().toISOString();
      if (!canvas) {
        setErrorProcesamiento('DESCONOCIDO');
        return;
      }

      // Fail-closed: si el detector de rostros no carga, la foto no sale.
      const difuminados = await procesarImagen(canvas);
      void difuminados;

      const blob = await comprimirImagen(canvas);
      await onCaptura({ blob, capturadaEn });
    } catch {
      setErrorProcesamiento('ROSTROS_FALLIDO');
    } finally {
      setProcesando(false);
    }
  };

  const mensajeError =
    error !== null
      ? MENSAJES_ERROR[error]
      : errorProcesamiento !== null
        ? MENSAJES_ERROR[errorProcesamiento]
        : null;

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          aria-label="Vista previa de la cámara"
        />
        {!activa && !mensajeError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-300">
            Pulsa «Activar cámara» para comenzar
          </div>
        )}
      </div>

      {mensajeError && (
        <p role="alert" className="text-sm text-red-700">
          {mensajeError}
        </p>
      )}

      <div className="flex gap-2">
        {!activa ? (
          <button
            type="button"
            onClick={() => void activar()}
            disabled={deshabilitado}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Activar cámara
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void handleCapturar()}
              disabled={deshabilitado || procesando}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {procesando ? 'Procesando…' : 'Capturar'}
            </button>
            <button
              type="button"
              onClick={detener}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Detener
            </button>
          </>
        )}
      </div>
    </div>
  );
}
