'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RouteBadge } from '@/components/RouteBadge';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/ui-extra/empty-state';
import { apiFetch } from '@/lib/api-client';
import { formatIsoDate } from '@/lib/format';
import type { Siniestro } from '@/domain/entities';
import type { BandejaPerito } from '@/domain/claim-state/review-flow';

type RespuestaLista = {
  items: Siniestro[];
  total: number;
  page: number;
  pageSize: number;
};

const RUTAS = ['', 'VERDE', 'AMARILLA', 'ROJA'] as const;
type Pestana = BandejaPerito;

export default function BandejaPage() {
  const [pestana, setPestana] = useState<Pestana>('pendientes');
  const [ruta, setRuta] = useState('');
  const [page, setPage] = useState(1);
  const [datos, setDatos] = useState<RespuestaLista | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    setError(null);
    const parametros = new URLSearchParams();
    if (ruta) parametros.set('ruta', ruta);
    parametros.set('page', String(page));
    parametros.set('pageSize', '20');

    parametros.set('bandeja', pestana);
    apiFetch<RespuestaLista>(`/api/siniestros?${parametros}`)
      .then((resultado) => {
        if (vigente) setDatos(resultado);
      })
      .catch(() => {
        if (vigente) setError('No se pudo cargar la bandeja');
      });
    return () => {
      vigente = false;
    };
  }, [pestana, ruta, page]);

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Bandeja de siniestros</h1>

      <div className="flex gap-2" role="tablist" aria-label="Pestañas de la bandeja">
        <button
          role="tab"
          aria-selected={pestana === 'pendientes'}
          onClick={() => {
            setPestana('pendientes');
            setPage(1);
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            pestana === 'pendientes'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Pendientes
        </button>
        <button
          role="tab"
          aria-selected={pestana === 'seguimiento'}
          onClick={() => {
            setPestana('seguimiento');
            setPage(1);
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${pestana === 'seguimiento' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          En seguimiento
        </button>
        <button
          role="tab"
          aria-selected={pestana === 'resueltos'}
          onClick={() => {
            setPestana('resueltos');
            setPage(1);
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            pestana === 'resueltos'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Resueltos
        </button>
      </div>

      <div className="flex gap-4 text-sm">
        <label>
          Ruta{' '}
          <select
            value={ruta}
            onChange={(e) => {
              setRuta(e.target.value);
              setPage(1);
            }}
            className="rounded-md border px-2 py-1"
            aria-label="Filtrar por ruta"
          >
            {RUTAS.map((r) => (
              <option key={r} value={r}>
                {r || 'Todas'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <ErrorState mensaje={error} />}
      {!datos && !error && <LoadingState />}
      {datos && datos.items.length === 0 && (
        <EmptyState
          titulo={
            pestana === 'pendientes'
              ? 'No hay casos pendientes'
              : pestana === 'seguimiento'
                ? 'No hay casos en seguimiento'
                : 'No hay casos resueltos'
          }
          descripcion={
            pestana === 'pendientes'
              ? 'Cuando un caso requiera revisión aparecerá aquí.'
              : pestana === 'seguimiento'
                ? 'Los casos en análisis, vía rápida o reparación aparecerán aquí.'
                : 'Aquí aparecen los casos finalizados o rechazados.'
          }
        />
      )}

      {datos && datos.items.length > 0 && (
        <>
          <ul className="space-y-3">
            {datos.items.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/perito/siniestros/${s.id}`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Siniestro {s.id.slice(0, 8)}</span>
                    <RouteBadge ruta={s.ruta} />
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {s.estado} · {formatIsoDate(s.fechaRegistro)}
                  </p>
                  {s.etiquetas.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.etiquetas.map((e) => (
                        <span
                          key={e}
                          className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {datos.total > 20 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página {page} de {Math.ceil(datos.total / 20)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= datos.total}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
