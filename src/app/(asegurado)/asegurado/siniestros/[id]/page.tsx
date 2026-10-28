'use client';

import Link from 'next/link';
import { AdditionalEvidence } from '@/components/claim/additional-evidence';
import { use } from 'react';
import { LoadingState } from '@/components/LoadingState';
import { RouteBadge } from '@/components/RouteBadge';
import { EvidenceImage } from '@/components/evidence-image';
import { AnalysisBasis } from '@/components/analysis-basis';
import { AnalysisProvenance } from '@/components/analysis-provenance';
import { ClaimTimeline } from '@/components/claim/ClaimTimeline';
import { usePolling } from '@/hooks/usePolling';
import { apiFetch } from '@/lib/api-client';
import { formatCurrencyUsd, formatIsoDate } from '@/lib/format';
import type { EvaluacionDanos, InspeccionPericial, Siniestro, Taller } from '@/domain/entities';

type Detalle = {
  siniestro: Siniestro;
  imagenes: { id: string; url: string; capturadaEn: string }[];
  inspeccion: InspeccionPericial | null;
  evaluaciones: EvaluacionDanos[];
  orden: {
    id: string;
    estado: string;
    montoAutorizado: number;
  } | null;
  taller: Taller | null;
};

function mensajeSiguientePaso(s: Siniestro, estadoOrden?: string): string {
  if (s.analisisEstado === 'EN_PROCESO' || s.analisisEstado === 'NO_INICIADO')
    return 'Estamos analizando tus fotos con IA. Esta página se actualiza automáticamente.';
  if (s.analisisEstado === 'FALLIDO')
    return 'No pudimos analizar las fotos. Un perito revisará tu caso manualmente.';
  if (s.estado === 'FINALIZADO') return 'La reparación terminó y tu caso está finalizado.';
  if (s.estado === 'RECHAZADO') return 'Un perito registró el rechazo. Consulta sus observaciones.';
  if (estadoOrden === 'EMITIDA')
    return 'La orden fue emitida. El taller todavía debe confirmar la recepción.';
  if (estadoOrden === 'RECIBIDO') return 'El taller confirmó la recepción del vehículo.';
  if (estadoOrden === 'EN_REPARACION') return 'Tu vehículo está en reparación.';
  switch (s.ruta) {
    case 'VERDE':
      return 'Tu caso fue aprobado para vía rápida. Se emitirá una orden de trabajo.';
    case 'AMARILLA':
      return 'Un perito revisará tus evidencias y te contactará.';
    case 'ROJA':
      return 'Detectamos daño mayor o sospecha de fraude. Se requiere inspección presencial.';
    default:
      return 'Pendiente de procesamiento.';
  }
}

export default function DetalleSiniestroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { valor: detalle, razonDetencion } = usePolling<Detalle>({
    consultar: () => apiFetch<Detalle>(`/api/siniestros/${id}`),
    esTerminal: (d) =>
      ['RECHAZADO', 'FINALIZADO'].includes(d.siniestro.estado) ||
      (d.siniestro.estado === 'PENDIENTE' && d.siniestro.analisisEstado === 'NO_INICIADO'),
    maxMs: 120_000,
    intervaloMs: 3000,
  });

  if (!detalle) return <LoadingState mensaje="Cargando siniestro…" />;

  const { siniestro, inspeccion, evaluaciones } = detalle;

  return (
    <main className="space-y-4">
      <Link href="/asegurado/siniestros" className="text-sm text-blue-600">
        ← Mis siniestros
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Siniestro {siniestro.id.slice(0, 8)}</h1>
        <RouteBadge ruta={siniestro.ruta} />
      </div>
      <ClaimTimeline siniestro={siniestro} estadoOrden={detalle.orden?.estado} />
      <button className="text-sm text-primary underline" onClick={() => window.location.reload()}>
        Actualizar seguimiento
      </button>
      <AnalysisProvenance inspeccion={inspeccion} />
      <AnalysisBasis inspeccion={inspeccion} />
      {siniestro.estado === 'PENDIENTE' && siniestro.analisisEstado === 'NO_INICIADO' && (
        <AdditionalEvidence id={id} ampliacion={false} existentes={detalle.imagenes.length} />
      )}
      {siniestro.estado === 'EN_REVISION' &&
        inspeccion?.dictamenFinal === 'AMPLIACION_REQUERIDA' && (
          <AdditionalEvidence id={id} ampliacion />
        )}
      <p className="text-sm text-gray-600">
        {mensajeSiguientePaso(siniestro, detalle.orden?.estado)}
      </p>
      {razonDetencion === 'tiempo' && (
        <p className="text-sm text-gray-600">
          La actualización automática se detuvo. Usa Actualizar seguimiento para consultar los
          últimos cambios.
        </p>
      )}
      {siniestro.etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label="Etiquetas">
          {siniestro.etiquetas.map((e) => (
            <span key={e} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              {e}
            </span>
          ))}
        </div>
      )}
      <dl className="text-sm text-gray-700">
        <div>
          <dt className="inline font-medium">Incidente: </dt>
          <dd className="inline">{formatIsoDate(siniestro.fechaIncidente)}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Estado: </dt>
          <dd className="inline">{siniestro.estado}</dd>
        </div>
      </dl>
      {inspeccion && inspeccion.observacionesPerito && inspeccion.dictamenFinal === 'RECHAZADO' && (
        <section className="rounded-md border border-red-200 bg-red-50 p-3">
          <h2 className="text-sm font-semibold text-red-800">Motivo del rechazo</h2>
          <p className="text-sm text-red-700">{inspeccion.observacionesPerito}</p>
        </section>
      )}
      {inspeccion &&
        inspeccion.observacionesPerito &&
        inspeccion.dictamenFinal === 'AMPLIACION_REQUERIDA' && (
          <section className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <h2 className="text-sm font-semibold text-amber-800">Solicitud de ampliación</h2>
            <p className="text-sm text-amber-700">{inspeccion.observacionesPerito}</p>
          </section>
        )}
      {inspeccion && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Resultado del análisis</h2>
          {detalle.orden && (
            <section className="rounded-md border border-blue-200 bg-blue-50 p-3">
              <h2 className="text-sm font-semibold">Orden de trabajo</h2>
              <p className="text-sm text-gray-700">
                Estado: <strong>{detalle.orden.estado}</strong> ·{' '}
                {formatCurrencyUsd(detalle.orden.montoAutorizado)}
              </p>
              {detalle.taller && (
                <p className="text-sm text-gray-700">
                  Taller: <strong>{detalle.taller.nombre}</strong>
                  {detalle.taller.direccion && ` — ${detalle.taller.direccion}`}
                </p>
              )}
            </section>
          )}
          <dl className="text-sm text-gray-700">
            {inspeccion.nivelSeveridad && (
              <div>
                <dt className="inline font-medium">Severidad: </dt>
                <dd className="inline">{inspeccion.nivelSeveridad}</dd>
              </div>
            )}
            {inspeccion.costoTotalEstimado !== null && (
              <div>
                <dt className="inline font-medium">Costo estimado: </dt>
                <dd className="inline">{formatCurrencyUsd(inspeccion.costoTotalEstimado)}</dd>
              </div>
            )}
          </dl>
          {evaluaciones.length > 0 && (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-1 pr-4">Pieza</th>
                  <th className="py-1 pr-4">Acción</th>
                  <th className="py-1 pr-4">Costo</th>
                </tr>
              </thead>
              <tbody>
                {evaluaciones.map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-1 pr-4">{ev.codigoPieza}</td>
                    <td className="py-1 pr-4">{ev.accionRequerida}</td>
                    <td className="py-1 pr-4">{formatCurrencyUsd(ev.costoPiezaEstimado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      <ul className="grid grid-cols-3 gap-2">
        {detalle.imagenes.map((img) => (
          <li key={img.id}>
            {}
            <EvidenceImage
              src={img.url}
              alt="Evidencia del siniestro"
              className="h-28 w-full rounded-md object-cover"
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
