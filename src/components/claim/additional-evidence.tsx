'use client';
import { useEffect, useState } from 'react';
import { CameraCapture, type CapturaResult } from '@/components/camera/CameraCapture';
import { apiFetch } from '@/lib/api-client';
import { mensajeDeError } from '@/lib/user-messages';
import { ErrorState } from '@/components/ErrorState';
import type { Ampliacion } from '@/application/use-cases/claim-amendment';
type Foto = CapturaResult & { id: string };

export function AdditionalEvidence({
  id,
  ampliacion,
  existentes = 0,
  soloConsulta = false,
}: {
  id: string;
  ampliacion: boolean;
  existentes?: number;
  soloConsulta?: boolean;
}) {
  const [solicitud, setSolicitud] = useState<Ampliacion | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completado, setCompletado] = useState(false);
  const [cargando, setCargando] = useState(ampliacion);
  useEffect(() => {
    if (!ampliacion) return;
    let vigente = true;
    const cargar = () =>
      apiFetch<{ ampliacion: Ampliacion | null }>(`/api/siniestros/${id}/ampliacion`)
        .then((r) => {
          if (vigente) setSolicitud(r.ampliacion);
        })
        .catch((e) => {
          if (vigente) setError(mensajeDeError(e));
        })
        .finally(() => {
          if (vigente) setCargando(false);
        });
    void cargar();
    const timer = soloConsulta ? setInterval(() => void cargar(), 5000) : undefined;
    return () => {
      vigente = false;
      clearInterval(timer);
    };
  }, [id, ampliacion, soloConsulta]);
  if (ampliacion && cargando) return <p>Cargando solicitud de ampliación…</p>;
  if (ampliacion && !solicitud)
    return (
      <p role="status">
        {error ?? 'Esta solicitud de ampliación ya no está disponible. Recarga el caso.'}
      </p>
    );
  const guardadas = ampliacion ? (solicitud?.cantidadFotos ?? 0) : existentes;
  async function enviar() {
    setOcupado(true);
    setError(null);
    try {
      for (const [index, foto] of fotos.entries()) {
        const body = new FormData();
        body.append('file', foto.blob, `${foto.id}.jpg`);
        body.append('imagen_id', foto.id);
        body.append('capturada_en', foto.capturadaEn);
        body.append('rostros_difuminados', 'true');
        body.append('orden', String(guardadas + index));
        if (solicitud) body.append('ampliacion_id', solicitud.id);
        await apiFetch(`/api/siniestros/${id}/imagenes`, { method: 'POST', body });
      }
      if (solicitud)
        await apiFetch(`/api/siniestros/${id}/ampliacion`, {
          method: 'POST',
          body: { ampliacion_id: solicitud.id },
        });
      else {
        const actual = await apiFetch<{ siniestro: { analisisEstado: string } }>(
          `/api/siniestros/${id}`,
        );
        if (actual.siniestro.analisisEstado === 'NO_INICIADO')
          await apiFetch(`/api/siniestros/${id}/analizar`, { method: 'POST' });
      }
      setCompletado(true);
      window.location.reload();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="space-y-3 rounded-2xl border bg-white p-5">
      <h2 className="font-semibold">
        {soloConsulta
          ? 'Estado de la ampliación'
          : ampliacion
            ? 'Responder la ampliación'
            : 'Completar reporte pendiente'}
      </h2>
      {error && <ErrorState mensaje={error} />}
      {solicitud && <p className="text-sm">{solicitud.observaciones}</p>}
      {completado || solicitud?.entregada ? (
        <p role="status">
          Ampliación entregada. El perito revisará las nuevas fotos; no se aprueba automáticamente.
          {soloConsulta && (
            <button className="ml-2 underline" onClick={() => window.location.reload()}>
              Actualizar fotos recibidas
            </button>
          )}
        </p>
      ) : soloConsulta ? (
        <p role="status">Esperando las fotos solicitadas al asegurado.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {guardadas} fotos guardadas.{' '}
            {ampliacion
              ? 'Puedes aportar de 1 a 5 fotos nuevas por solicitud.'
              : 'Completa al menos 3 fotos, hasta un máximo de 5, sin crear otro siniestro.'}{' '}
            Las fotos anteriores se conservan.
          </p>
          <CameraCapture
            deshabilitado={ocupado || fotos.length + guardadas >= 5}
            onCaptura={(foto) => setFotos((f) => [...f, { ...foto, id: crypto.randomUUID() }])}
          />
          <ul className="space-y-1 text-sm">
            {fotos.map((foto, n) => (
              <li key={foto.id}>
                Foto nueva {n + 1}{' '}
                <button
                  disabled={ocupado}
                  className="underline"
                  onClick={() => setFotos((f) => f.filter((x) => x.id !== foto.id))}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
          <button
            className="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50"
            disabled={
              ocupado ||
              (ampliacion
                ? !solicitud || guardadas + fotos.length < 1
                : guardadas + fotos.length < 3)
            }
            onClick={() => void enviar()}
          >
            {ocupado
              ? 'Enviando…'
              : ampliacion
                ? 'Enviar ampliación al perito'
                : 'Completar y analizar'}
          </button>
        </>
      )}
    </section>
  );
}
