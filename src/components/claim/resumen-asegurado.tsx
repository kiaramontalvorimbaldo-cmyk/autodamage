'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Car, CarFront, ClipboardList, PlusCircle } from 'lucide-react';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { RouteBadge } from '@/components/RouteBadge';
import { buttonClasses } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { formatIsoDate } from '@/lib/format';
import { mensajeDeError } from '@/lib/user-messages';
import type { Siniestro, Vehiculo } from '@/domain/entities';

type RespuestaLista = { items: Siniestro[]; total: number };

const ESTADOS_ACTIVOS = new Set(['PENDIENTE', 'FAST_TRACK', 'EN_REVISION']);

/**
 * Resumen del inicio del asegurado: vehículos, siniestros activos y
 * último siniestro. Si no hay vehículos, muestra la guía de dos pasos.
 */
export function ResumenAsegurado() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[] | null>(null);
  const [siniestros, setSiniestros] = useState<Siniestro[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    const signal = AbortSignal.timeout(12_000);
    // Las dos consultas son independientes: se piden en paralelo.
    Promise.all([
      apiFetch<Vehiculo[]>('/api/vehiculos', { signal }),
      apiFetch<RespuestaLista>('/api/siniestros?pageSize=20', { signal }),
    ])
      .then(([listaVehiculos, listaSiniestros]) => {
        setVehiculos(listaVehiculos);
        setSiniestros(listaSiniestros.items);
      })
      .catch((e: unknown) => setError(mensajeDeError(e)))
      .finally(() => setCargando(false));
  }, []);

  useEffect(cargar, [cargar]);

  if (error) return <ErrorState mensaje={error} alReintentar={cargar} />;
  if (cargando) return <LoadingState mensaje="Cargando tu resumen…" />;

  const activos = (siniestros ?? []).filter((s) => ESTADOS_ACTIVOS.has(s.estado));
  const ultimo = (siniestros ?? [])[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <CarFront aria-hidden="true" className="h-4 w-4" />
            Vehículos registrados
          </p>
          <p className="mt-1 text-2xl font-semibold">{vehiculos?.length ?? 0}</p>
          <Link
            href="/asegurado/vehiculos"
            className="text-primary mt-1 inline-block text-sm underline"
          >
            Ver mis vehículos
          </Link>
        </article>

        <article className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <ClipboardList aria-hidden="true" className="h-4 w-4" />
            Siniestros en curso
          </p>
          <p className="mt-1 text-2xl font-semibold">{activos.length}</p>
          <Link href="/asegurado/siniestros" className="text-primary mt-1 inline-block text-sm underline">
            Ver mis siniestros
          </Link>
        </article>
      </div>

      {ultimo && (
        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Último siniestro</h2>
            <RouteBadge ruta={ultimo.ruta} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {formatIsoDate(ultimo.fechaIncidente)} · {ultimo.estado}
          </p>
          <Link
            href={`/asegurado/siniestros/${ultimo.id}`}
            className="text-primary mt-2 inline-block text-sm underline"
          >
            Ver el seguimiento
          </Link>
        </section>
      )}

      {(vehiculos?.length ?? 0) === 0 && (
        <section className="rounded-lg border border-dashed p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Car aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
            Empieza por aquí
          </h2>
          <ol className="mt-3 space-y-3">
            <li className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">1.</span>
              <span>Registra tu vehículo</span>
              <Link href="/asegurado/vehiculos/nuevo" className={buttonClasses({ size: 'sm' })}>
                <PlusCircle aria-hidden="true" className="h-4 w-4" />
                Registrar vehículo
              </Link>
            </li>
            <li className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">2.</span>
              <span>Reporta tu siniestro</span>
              <Link href="/asegurado/nuevo-siniestro" className={buttonClasses({ size: 'sm' })}>
                Reportar siniestro
              </Link>
            </li>
          </ol>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/asegurado/nuevo-siniestro" className={buttonClasses()}>
          <PlusCircle aria-hidden="true" className="h-4 w-4" />
          Reportar siniestro
        </Link>
        <Link href="/asegurado/siniestros" className={buttonClasses({ variant: 'outline' })}>
          <ClipboardList aria-hidden="true" className="h-4 w-4" />
          Mis siniestros
        </Link>
      </div>
    </div>
  );
}