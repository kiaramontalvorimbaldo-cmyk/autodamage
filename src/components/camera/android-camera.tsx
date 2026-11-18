'use client';
import { useState } from 'react';
import { solicitarAndroid } from '@/lib/android-bridge';
import { procesarImagen } from '@/lib/faceBlur';
import { comprimirImagen } from '@/lib/compressImage';
import { Button } from '@/components/ui/button';
export function AndroidCamera({
  onCaptura,
  deshabilitado,
}: {
  onCaptura: (value: { blob: Blob; capturadaEn: string }) => void | Promise<void>;
  deshabilitado: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function capture() {
    setBusy(true);
    setError('');
    try {
      const { jpeg } = await solicitarAndroid<{ jpeg: string }>('capture');
      if (!jpeg.startsWith('data:image/jpeg;base64,')) throw new Error('FOTO_INVALIDA');
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = jpeg;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('FOTO_INVALIDA');
      context.drawImage(image, 0, 0);
      await procesarImagen(canvas);
      await onCaptura({
        blob: await comprimirImagen(canvas),
        capturadaEn: new Date().toISOString(),
      });
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : '';
      setError(
        code === 'CANCELADO'
          ? 'Captura cancelada. Puedes volver a intentarlo.'
          : code === 'SIN_PERMISO'
            ? 'Permite el acceso a la cámara en los ajustes de Android.'
            : 'No se pudo preparar la foto con la protección de rostros. No se enviará; vuelve a intentarlo.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Captura una foto nueva del vehículo. Los rostros se difuminan antes de enviarla.
      </p>
      <Button disabled={busy || deshabilitado} onClick={() => void capture()}>
        {busy ? 'Preparando foto…' : 'Tomar foto con el teléfono'}
      </Button>
      {error && (
        <p role="status" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
