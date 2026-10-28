'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FileText, PlusCircle } from 'lucide-react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ClaimCard } from '@/components/ClaimCard';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/ui-extra/empty-state';
import { buttonClasses } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { mensajeDeError } from '@/lib/user-messages';
import type { Siniestro } from '@/domain/entities';
import type { EstadoSiniestro } from '@/domain/types';

type RespuestaLista = {
  items: Siniestro[];
  total: number;
  page: number;
  pageSize: number;
};

const FILTROS: { valor: EstadoSiniestro | ''; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'PENDIENTE', etiqueta: 'Pendientes' },
  { valor: 'EN_REVISION', etiqueta: 'En revisión' },
  { valor: 'FAST_TRACK', etiqueta: 'En trámite rápido' },
  { valor: 'APROBADO', etiqueta: 'Aprobados' },
  { valor: 'FINALIZADO', etiqueta: 'Finalizados' },
];

export default function ListaSiniestrosPage() {
  const [datos, setDatos] = useState<RespuestaLista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoSiniestro | ''>('');

  const cargar = useCallback(() => {
    setError(null);
    const consulta = new URLSearchParams({ pageSize: '20' });
    if (estado) consulta.set('estado', estado);
    apiFetch<RespuestaLista>(`/api/siniestros?${consulta.toString()}`)
      .then(setDatos)
      .catch((e: unknown) => setError(mensajeDeError(e)));
  }, [estado]);

  useEffect(cargar, [cargar]);

  return (
    <section className="space-y-4">
      <Breadcrumbs
        migas={[
          { etiqueta: 'Inicio', href: '/asegurado' },
          { etiqueta: 'Mis siniestros' },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Mis siniestros</h1>
        <Link href="/asegurado/nuevo-siniestro" className={buttonClasses()}>
          <PlusCircle aria-hidden="true" className="h-4 w-4" />
          Reportar siniestro
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span id="filtro-estado-label" className="text-muted-foreground text-sm">
          Filtrar por estado:
        </span>
        <div role="group" aria-labelledby="filtro-estado-label" className="flex flex-wrap gap-1">
          {FILTROS.map((filtro) => (
            <button
              key={filtro.valor || 'todos'}
              type="button"
              onClick={() => setEstado(filtro.valor)}
              aria-pressed={estado === filtro.valor}
              className={`rounded-md border px-3 py-1 text-sm ${
                estado === filtro.valor ? 'border-primary bg-primary/5 font-medium' : 'border-border'
              }`}
            >
              {filtro.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorState mensaje={error} alReintentar={cargar} />}
      {!datos && !error && <LoadingState mensaje="Cargando tus siniestros…" />}

      {datos?.items.length === 0 && (
        <EmptyState
          icono={<FileText aria-hidden="true" className="h-8 w-8 text-muted-foreground" />}
          titulo="Aún no has reportado siniestros"
          descripcion="Cuando tengas un daño en tu vehículo, repórtalo aquí y sigue su avance."
          accion={
            <Link href="/asegurado/nuevo-siniestro" className={buttonClasses()}>
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              Reportar siniestro
            </Link>
          }
        />
      )}

      <ul className="space-y-3">
        {datos?.items.map((siniestro) => (
          <li key={siniestro.id}>
            <Link
              href={`/asegurado/siniestros/${siniestro.id}`}
              aria-label={`Ver siniestro del ${siniestro.fechaIncidente.slice(0, 10)}`}
            >
              <ClaimCard siniestro={siniestro} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}