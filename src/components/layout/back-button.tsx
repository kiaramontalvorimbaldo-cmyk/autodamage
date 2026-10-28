'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Botón "Volver": usa el historial del navegador y, si no hay historial,
 * cae en una ruta de respaldo para que nunca sea un callejón sin salida.
 */
export function BackButton({
  fallbackHref,
  etiqueta = 'Volver',
  className,
}: {
  fallbackHref: string;
  etiqueta?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className={cn(
        'focus-visible:ring-ring inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2',
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      {etiqueta}
    </button>
  );
}