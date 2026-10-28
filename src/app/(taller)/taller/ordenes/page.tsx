'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/ui-extra/empty-state';
import { apiFetch } from '@/lib/api-client';
import { mensajeDeError } from '@/lib/user-messages';
import { formatCurrencyUsd, formatIsoDate } from '@/lib/format';
import type { Orden } from '@/domain/entities';

const ESTADOS = ['', 'EMITIDA', 'RECIBIDO', 'EN_REPARACION', 'COMPLETADO'];

export default function OrdenesPage() {
  const [estado, setEstado] = useState('');
  const [ordenes, setOrdenes] = useState<Orden[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelado = false;
    setOrdenes(null);
    setCargando(true);
    setError(null);
    const q = estado ? `?estado=${estado}` : '';
    const timeout = window.setTimeout(
      () => controller.abort(new DOMException('Tiempo agotado', 'TimeoutError')),
      12_000,
    );

    apiFetch<{ ordenes: Orden[] }>(`/api/ordenes${q}`, { signal: controller.signal })
      .then((r) => setOrdenes(r.ordenes))
      .catch((e: unknown) => {
        if (!cancelado) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
        window.clearTimeout(timeout);
      });

    return () => {
      cancelado = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [estado, intento]);

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Órdenes de trabajo</h1>
      <label className="text-sm">
        Estado{' '}
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          aria-label="Filtrar por estado"
          className="rounded-md border px-2 py-1"
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e || 'Todos'}
            </option>
          ))}
        </select>
      </label>
      {error && <ErrorState mensaje={error} alReintentar={() => setIntento((i) => i + 1)} />}
      {cargando && !error && <LoadingState mensaje="Cargando órdenes de trabajo…" />}
      {ordenes && ordenes.length === 0 && (
        <EmptyState
          titulo="No tienes órdenes asignadas"
          descripcion="Las órdenes aparecen cuando un caso verde se deriva automáticamente o cuando un perito aprueba un caso amarillo. Los casos que siguen en revisión todavía no generan una orden."
        />
      )}
      <ul className="space-y-3">
        {ordenes?.map((o) => (
          <li key={o.id}>
            <Link
              href={`/taller/ordenes/${o.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Orden {o.id.slice(0, 8)}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{o.estado}</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Monto autorizado: {formatCurrencyUsd(o.montoAutorizado)} ·{' '}
                {formatIsoDate(o.creadoEn)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
