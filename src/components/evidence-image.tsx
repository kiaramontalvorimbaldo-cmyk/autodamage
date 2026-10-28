'use client';

import { useState } from 'react';

/** No deja imágenes rotas sin explicación y no sustituye la evidencia original. */
export function EvidenceImage({
  src,
  alt = 'Evidencia del siniestro',
  className,
  onLoad,
}: {
  src: string;
  alt?: string;
  className?: string;
  onLoad?: () => void;
}) {
  const [fallida, setFallida] = useState<string | null>(null);
  if (fallida === src)
    return (
      <div
        role="status"
        className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        No se pudo cargar esta evidencia. Vuelve a abrir el caso para renovar el acceso. Si
        persiste, el archivo necesita revisión.
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onLoad={onLoad}
      onError={() => setFallida(src)}
      draggable={false}
    />
  );
}
