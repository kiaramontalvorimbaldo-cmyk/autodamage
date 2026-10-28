'use client';

import type { Ruta } from '@/domain/types';

const ESTILOS: Record<Ruta, string> = {
  VERDE: 'bg-green-100 text-green-900 border-green-300',
  AMARILLA: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  ROJA: 'bg-red-100 text-red-900 border-red-300',
};

const TEXTO_ACCESIBLE: Record<Ruta, string> = {
  VERDE: 'Ruta verde: trámite rápido automático',
  AMARILLA: 'Ruta amarilla: revisión por un perito',
  ROJA: 'Ruta roja: inspección presencial obligatoria',
};

/**
 * Insignia de ruta con texto accesible (no solo color).
 */
export function RouteBadge({ ruta }: { ruta: Ruta | null }) {
  if (!ruta) {
    return (
      <span className="inline-flex items-center rounded-md border border-gray-300 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
        Sin ruta asignada
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${ESTILOS[ruta]}`}
      role="status"
      aria-label={TEXTO_ACCESIBLE[ruta]}
    >
      {ruta === 'VERDE' && 'Verde'}
      {ruta === 'AMARILLA' && 'Amarilla'}
      {ruta === 'ROJA' && 'Roja'}
    </span>
  );
}
