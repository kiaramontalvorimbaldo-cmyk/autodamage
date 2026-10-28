'use client';

import { EvidenceImage } from '@/components/evidence-image';
import type { PiezaVista } from '@/lib/piezas-vista';

/**
 * Convierte coordenadas normalizadas 0–1000 (convención de la IA:
 * [ymin, xmin, ymax, xmax]) a píxeles según el tamaño mostrado.
 */
export function escalarCoordenadas(
  bbox: readonly [number, number, number, number],
  anchoContenedor: number,
  altoContenedor: number,
): { x: number; y: number; ancho: number; alto: number } {
  const [ymin, xmin, ymax, xmax] = bbox;
  const x = (xmin / 1000) * anchoContenedor;
  const y = (ymin / 1000) * altoContenedor;
  const ancho = ((xmax - xmin) / 1000) * anchoContenedor;
  const alto = ((ymax - ymin) / 1000) * altoContenedor;
  return { x, y, ancho, alto };
}

/**
 * Visor de imagen con cajas de daño superpuestas (SVG).
 * Las coordenadas de la IA (0–1000) se escalan al tamaño
 * real de la imagen mostrada.
 */
export function DamageViewer({
  imagenUrl,
  piezas,
  nombresPiezas,
}: {
  imagenUrl: string;
  piezas: readonly PiezaVista[];
  nombresPiezas?: Map<string, string>;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-gray-100" data-testid="damage-viewer">
      {}
      <EvidenceImage
        src={imagenUrl}
        alt="Evidencia del siniestro"
        className="block h-auto w-full"
      />
      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-label="Cajas de daño detectadas"
        role="img"
      >
        {piezas
          .filter((pieza) => pieza.bbox !== null)
          .map((pieza, indice) => {
            const region = escalarCoordenadas(
              pieza.bbox as readonly [number, number, number, number],
              1000,
              1000,
            );
            return (
              <g key={`${pieza.evaluacionId}-${indice}`}>
                <rect
                  x={region.x}
                  y={region.y}
                  width={region.ancho}
                  height={region.alto}
                  fill="rgba(239, 68, 68, 0.15)"
                  stroke="#ef4444"
                  strokeWidth="2"
                  rx="2"
                />
                <title>
                  {nombresPiezas?.get(pieza.codigoPieza) ?? pieza.codigoPieza} —{' '}
                  {pieza.accionRequerida} — confianza{' '}
                  {pieza.confianza === null ? '—' : `${Math.round(pieza.confianza * 100)}%`}
                </title>
              </g>
            );
          })}
      </svg>
    </div>
  );
}
