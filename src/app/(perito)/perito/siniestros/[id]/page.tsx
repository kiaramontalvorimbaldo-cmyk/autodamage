'use client';

import dynamic from 'next/dynamic';
import { AdditionalEvidence } from '@/components/claim/additional-evidence';
import { RecoverWorkOrder, RecoverAnalysis } from '@/components/recover-work-order';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { DamageViewer } from '@/components/perito/DamageViewer';
import { PartsTable } from '@/components/perito/PartsTable';
import { VerdictForm } from '@/components/perito/VerdictForm';
import { RouteBadge } from '@/components/RouteBadge';
import { EvidenceImage } from '@/components/evidence-image';
import { AnalysisBasis } from '@/components/analysis-basis';
import { AnalysisProvenance } from '@/components/analysis-provenance';
import { admiteDictamen } from '@/domain/claim-state/review-flow';
import Link from 'next/link';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { apiFetch, ApiError } from '@/lib/api-client';
import { sumarCostos, type PiezaVista } from '@/lib/piezas-vista';
import { formatCurrencyUsd } from '@/lib/format';
import type { EvaluacionDanos, InspeccionPericial, Siniestro } from '@/domain/entities';

const ClaimMap = dynamic(
  () =>
    import('@/components/perito/ClaimMap').then((mod) => ({
      default: mod.ClaimMap,
    })),
  { ssr: false },
);

type Detalle = {
  siniestro: Siniestro;
  orden?: { estado: string } | null;
  taller?: { nombre: string } | null;
  imagenes: {
    id: string;
    url: string;
    capturadaEn: string;
    latitud: number | null;
    longitud: number | null;
  }[];
  inspeccion: InspeccionPericial | null;
  evaluaciones: EvaluacionDanos[];
};

function aPiezaVista(ev: EvaluacionDanos): PiezaVista {
  return {
    imagenId: ev.imagenId,
    evaluacionId: ev.id,
    codigoPieza: ev.codigoPieza,
    accionRequerida: ev.accionRequerida,
    costoPiezaEstimado: ev.costoPiezaEstimado,
    confianza: ev.confianza,
    bbox: ev.bbox,
    aprobadoPorPerito: ev.aprobadoPorPerito,
    observacionPieza: ev.observacionPieza,
  };
}

function AuditoriaLista({ id }: { id: string }) {
  const [registros, setRegistros] = useState<
    { id: string; accion: string; actorTipo: string; creadoEn: string; datos?: unknown }[] | null
  >(null);

  useEffect(() => {
    apiFetch<{
      registros: {
        id: string;
        accion: string;
        actorTipo: string;
        creadoEn: string;
        datos?: unknown;
      }[];
    }>(`/api/siniestros/${id}/auditoria`)
      .then((r) => setRegistros(r.registros))
      .catch(() => setRegistros([]));
  }, [id]);

  if (!registros) return <LoadingState />;
  if (registros.length === 0)
    return <p className="text-sm text-gray-600">Sin registros todavía.</p>;

  return (
    <ol className="space-y-1 text-sm text-gray-700">
      {registros.map((r) => (
        <li key={r.id}>
          <time className="text-gray-500">{new Date(r.creadoEn).toLocaleString('es-ES')}</time> —{' '}
          <strong>{r.accion}</strong> ({r.actorTipo})
          {r.accion === 'TRIAJE_DECIDIDO' &&
          r.datos &&
          typeof r.datos === 'object' &&
          'razones' in r.datos &&
          Array.isArray(r.datos.razones) ? (
            <ul className="ml-4 list-disc">
              {r.datos.razones
                .filter((v): v is string => typeof v === 'string')
                .map((v, i) => (
                  <li key={i}>Regla del sistema: {v}</li>
                ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export default function DetallePeritoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [piezas, setPiezas] = useState<PiezaVista[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [imagenIndice, setImagenIndice] = useState(0);

  useEffect(() => {
    let vigente = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cargar = () =>
      apiFetch<Detalle>(`/api/siniestros/${id}`)
        .then((d) => {
          if (!vigente) return;
          setDetalle(d);
          setPiezas(d.evaluaciones.map(aPiezaVista));
          if (d.siniestro.analisisEstado === 'EN_PROCESO') timer = setTimeout(cargar, 3000);
        })
        .catch(() => {
          if (vigente) setError('No se pudo cargar el siniestro');
        });
    void cargar();
    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [id]);

  if (error && !detalle) return <ErrorState mensaje={error} />;
  if (!detalle) return <LoadingState />;

  const { siniestro, inspeccion } = detalle;
  const imagenPrincipal = detalle.imagenes[imagenIndice] ?? detalle.imagenes[0];
  const editable = admiteDictamen(siniestro) && inspeccion !== null;
  const puedeReanalizar =
    ['PENDIENTE', 'EN_REVISION'].includes(siniestro.estado) &&
    siniestro.analisisEstado !== 'EN_PROCESO' &&
    (siniestro.analisisEstado === 'FALLIDO' ||
      siniestro.etiquetas.includes('IA_NO_DISPONIBLE') ||
      siniestro.etiquetas.includes('AMPLIACION_RECIBIDA'));
  const puntosFotos = detalle.imagenes
    .filter((i) => i.latitud !== null && i.longitud !== null)
    .map((i) => ({
      latitud: i.latitud as number,
      longitud: i.longitud as number,
      etiqueta: 'Foto',
    }));

  async function alEnviarDictamen(datos: {
    dictamenFinal: 'APROBADO' | 'RECHAZADO' | 'AMPLIACION_REQUERIDA';
    observacionesPerito: string | null;
    kilometraje: number | null;
  }) {
    if (!editable) return;
    setEnviando(true);
    setError(null);
    try {
      await apiFetch(`/api/siniestros/${id}/dictamen`, {
        method: 'POST',
        body: {
          dictamen_final: datos.dictamenFinal,
          observaciones_perito: datos.observacionesPerito,
          kilometraje: datos.kilometraje,
          ajustes: piezas.map((p) => ({
            evaluacion_id: p.evaluacionId,
            accion_requerida: p.accionRequerida,
            costo_pieza_estimado: p.costoPiezaEstimado,
            aprobado_por_perito: p.aprobadoPorPerito,
            observacion_pieza: p.observacionPieza,
          })),
        },
      });
      router.push('/perito');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al registrar el dictamen');
      setEnviando(false);
    }
  }

  return (
    <main className="space-y-6">
      <Link href="/perito" className="text-sm text-primary">
        ← Volver a la bandeja
      </Link>
      {error && <ErrorState mensaje={error} />}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Siniestro {siniestro.id.slice(0, 8)}</h1>
        <RouteBadge ruta={siniestro.ruta} />
      </div>
      {detalle.orden && (
        <p className="rounded-xl border bg-white p-4 text-sm">
          Taller asignado: <strong>{detalle.taller?.nombre ?? 'Pendiente de confirmar'}</strong> ·
          Orden: {detalle.orden.estado}. Solo la cuenta vinculada a ese taller puede verla.
        </p>
      )}
      <AnalysisProvenance inspeccion={inspeccion} />
      <AnalysisBasis inspeccion={inspeccion} />
      {siniestro.analisisEstado === 'EN_PROCESO' &&
        siniestro.analisisIniciadoEn &&
        Date.now() - new Date(siniestro.analisisIniciadoEn).getTime() > 300000 && (
          <RecoverAnalysis id={id} />
        )}
      {!detalle.orden &&
        (siniestro.estado === 'APROBADO' ||
          siniestro.estado === 'FAST_TRACK' ||
          (siniestro.estado === 'EN_REVISION' &&
            (inspeccion?.dictamenFinal === 'APROBADO' ||
              (siniestro.ruta === 'VERDE' && !inspeccion?.dictamenFinal)))) && (
          <RecoverWorkOrder id={id} />
        )}
      {siniestro.estado === 'EN_REVISION' &&
        inspeccion?.dictamenFinal === 'AMPLIACION_REQUERIDA' && (
          <AdditionalEvidence id={id} ampliacion soloConsulta />
        )}
      {!editable && (
        <p role="status" className="rounded-xl border bg-white p-4 text-sm">
          {siniestro.analisisEstado === 'EN_PROCESO'
            ? 'El análisis está en curso. El resultado se actualizará automáticamente.'
            : siniestro.estado === 'FAST_TRACK'
              ? 'Caso de vía rápida en seguimiento. La orden de trabajo continúa con el taller; aquí puedes consultar las evidencias.'
              : 'Consulta de seguimiento. El dictamen solo está disponible para casos en revisión.'}
        </p>
      )}

      {inspeccion && (
        <dl className="grid grid-cols-2 gap-2 text-sm text-gray-700 sm:grid-cols-4">
          <div>
            <dt className="font-medium">Severidad</dt>
            <dd>{inspeccion.nivelSeveridad ?? '—'}</dd>
          </div>
          <div>
            <dt className="font-medium">Confianza</dt>
            <dd>
              {inspeccion.confianzaGlobal !== null
                ? `${Math.round(inspeccion.confianzaGlobal * 100)}%`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Veredicto fraude</dt>
            <dd>{inspeccion.verdictFraude}</dd>
          </div>
          <div>
            <dt className="font-medium">Costo estimado</dt>
            <dd>
              {inspeccion.costoTotalEstimado !== null
                ? formatCurrencyUsd(inspeccion.costoTotalEstimado)
                : '—'}
            </dd>
          </div>
        </dl>
      )}

      {inspeccion && inspeccion.indicadoresFraude.length > 0 && (
        <p className="text-sm text-red-700">
          Indicadores: {inspeccion.indicadoresFraude.join(', ')}
        </p>
      )}

      {puedeReanalizar && (
        <button
          type="button"
          onClick={async () => {
            setError(null);
            try {
              await apiFetch(`/api/siniestros/${id}/reanalizar`, {
                method: 'POST',
              });
              window.location.reload();
            } catch (e) {
              setError(e instanceof ApiError ? e.message : 'No se pudo reanalizar');
            }
          }}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white"
        >
          {siniestro.etiquetas.includes('AMPLIACION_RECIBIDA')
            ? 'Analizar fotos ampliadas'
            : 'Reintentar análisis'}
        </button>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Historial de auditoría</h2>
        <AuditoriaLista id={id} />
      </section>

      {imagenPrincipal && (
        <section className="space-y-3" aria-label="Evidencias del siniestro">
          <DamageViewer
            imagenUrl={imagenPrincipal.url}
            piezas={piezas.filter((p) => p.imagenId === imagenPrincipal.id)}
          />
          <div className="flex flex-wrap gap-3">
            {detalle.imagenes.map((imagen, index) => (
              <button
                key={imagen.id}
                type="button"
                aria-label={`Ver foto ${index + 1}`}
                aria-pressed={imagenPrincipal.id === imagen.id}
                onClick={() => setImagenIndice(index)}
                className="w-28 overflow-hidden rounded-lg border-2 border-transparent aria-pressed:border-primary"
              >
                <EvidenceImage
                  src={imagen.url}
                  alt={`Foto ${index + 1}`}
                  className="h-20 w-full object-cover"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Piezas ({piezas.length}) — Total: {formatCurrencyUsd(sumarCostos(piezas))}
        </h2>
        <PartsTable piezas={piezas} onChange={setPiezas} soloLectura={!editable} />
      </section>

      <ClaimMap centro={[siniestro.latitud, siniestro.longitud]} puntos={puntosFotos} />

      {editable && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Dictamen</h2>
          <VerdictForm onSubmit={alEnviarDictamen} enviando={enviando} />
        </section>
      )}
    </main>
  );
}
