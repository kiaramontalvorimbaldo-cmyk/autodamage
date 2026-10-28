'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ErrorCamara = 'SIN_PERMISO' | 'SIN_CAMARA' | 'NO_DISPONIBLE' | 'DESCONOCIDO';

export type UseCameraResult = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  activa: boolean;
  error: ErrorCamara | null;
  /** Solicita permiso y muestra la cámara trasera. */
  activar: () => Promise<void>;
  /** Detiene todas las pistas del stream. */
  detener: () => void;
  /** Dibuja el fotograma actual en un canvas (captura en vivo). */
  capturar: () => HTMLCanvasElement | null;
};

/**
 * Hook de cámara: usa getUserMedia con la cámara trasera.
 * Requiere un gesto del usuario (necesario en iOS/Safari).
 * Las pistas se detienen al desmontar.
 */
export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const solicitudRef = useRef(0);
  const [activa, setActiva] = useState(false);
  const [error, setError] = useState<ErrorCamara | null>(null);

  const detener = useCallback(() => {
    solicitudRef.current += 1;
    const stream = streamRef.current;
    if (stream) {
      for (const pista of stream.getTracks()) {
        pista.stop();
      }
      streamRef.current = null;
    }
    setActiva(false);
  }, []);

  const activar = useCallback(async () => {
    detener();
    const solicitud = solicitudRef.current;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('NO_DISPONIBLE');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (solicitud !== solicitudRef.current) {
        for (const pista of stream.getTracks()) pista.stop();
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (solicitud !== solicitudRef.current) return;
      setActiva(true);
    } catch (e) {
      if (solicitud !== solicitudRef.current) return;
      detener();
      const nombre = e instanceof DOMException ? e.name : '';
      if (nombre === 'NotAllowedError' || nombre === 'PermissionDeniedError') {
        setError('SIN_PERMISO');
      } else if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
        setError('SIN_CAMARA');
      } else {
        setError('DESCONOCIDO');
      }
    }
  }, [detener]);

  const capturar = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas;
  }, []);

  useEffect(() => {
    return () => {
      detener();
    };
  }, [detener]);

  return { videoRef, activa, error, activar, detener, capturar };
}
