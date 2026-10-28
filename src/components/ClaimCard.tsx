'use client';

import { RouteBadge } from '@/components/RouteBadge';
import { formatIsoDate } from '@/lib/format';
import type { Siniestro } from '@/domain/entities';

/**
 * Tarjeta resumen de un siniestro para listados.
 */
export function ClaimCard({ siniestro }: { siniestro: Siniestro }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900">Siniestro {siniestro.id.slice(0, 8)}</h3>
        <RouteBadge ruta={siniestro.ruta} />
      </div>
      <dl className="mt-2 space-y-1 text-sm text-gray-600">
        <div className="flex justify-between">
          <dt>Estado</dt>
          <dd className="font-medium">{siniestro.estado}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Incidente</dt>
          <dd>{formatIsoDate(siniestro.fechaIncidente)}</dd>
        </div>
        {siniestro.descripcion && <p className="pt-1 text-gray-500">{siniestro.descripcion}</p>}
        {siniestro.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1" aria-label="Etiquetas">
            {siniestro.etiquetas.map((etiqueta) => (
              <span
                key={etiqueta}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
              >
                {etiqueta}
              </span>
            ))}
          </div>
        )}
      </dl>
    </article>
  );
}
