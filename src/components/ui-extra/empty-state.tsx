import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Estado vacío: explica qué falta y ofrece la acción que lo resuelve.
 * Nunca se presenta como error (no se pinta en rojo).
 */
export function EmptyState({
  icono,
  titulo,
  descripcion,
  accion,
  className,
}: {
  icono?: ReactNode;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50/60 p-8 text-center',
        className,
      )}
    >
      {icono && <div aria-hidden="true">{icono}</div>}
      <h2 className="text-base font-semibold text-gray-800">{titulo}</h2>
      {descripcion && <p className="max-w-md text-sm text-gray-600">{descripcion}</p>}
      {accion && <div className="pt-1">{accion}</div>}
    </section>
  );
}