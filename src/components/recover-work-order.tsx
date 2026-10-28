'use client';
import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
export function RecoverAnalysis({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <section className="rounded-xl border bg-amber-50 p-4">
      <p className="text-sm">
        El análisis lleva más de 5 minutos sin terminar. Puedes recuperar el caso y luego reintentar
        el análisis.
      </p>
      <button
        disabled={ocupado}
        className="mt-2 rounded-lg border bg-white px-4 py-2"
        onClick={async () => {
          setOcupado(true);
          try {
            await apiFetch(`/api/siniestros/${id}/recuperar-analisis`, { method: 'POST' });
            window.location.reload();
          } catch (e) {
            setError(e instanceof ApiError ? e.message : 'No se pudo confirmar la recuperación');
          } finally {
            setOcupado(false);
          }
        }}
      >
        Recuperar análisis detenido
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function RecoverWorkOrder({ id }: { id: string }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <section className="space-y-2 rounded-xl border bg-amber-50 p-4">
      <p className="text-sm">Este caso admite una orden, pero todavía no tiene taller asignado.</p>
      <button
        disabled={ocupado}
        className="rounded-lg border bg-white px-4 py-2"
        onClick={async () => {
          setOcupado(true);
          try {
            const r = await apiFetch<{ orden: unknown; mensaje: string }>(
              `/api/siniestros/${id}/orden`,
              { method: 'POST' },
            );
            setMensaje(r.mensaje);
            if (r.orden) window.location.reload();
          } catch (e) {
            setMensaje(
              e instanceof ApiError
                ? e.message
                : 'No se pudo confirmar la orden. Recarga antes de reintentar.',
            );
          } finally {
            setOcupado(false);
          }
        }}
      >
        {ocupado ? 'Consultando…' : 'Reintentar asignación al taller'}
      </button>
      {mensaje && (
        <p role="status" className="text-sm">
          {mensaje}
        </p>
      )}
    </section>
  );
}
