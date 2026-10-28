'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Car, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/ui-extra/empty-state';
import { Button, buttonClasses } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api-client';
import { mensajeDeError } from '@/lib/user-messages';
import type { Vehiculo } from '@/domain/entities';

export default function MisVehiculosPage() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [porEliminar, setPorEliminar] = useState<Vehiculo | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(() => {
    setError(null);
    apiFetch<Vehiculo[]>('/api/vehiculos')
      .then(setVehiculos)
      .catch((e: unknown) => setError(mensajeDeError(e)));
  }, []);

  useEffect(cargar, [cargar]);

  async function confirmarEliminacion() {
    if (!porEliminar) return;
    setEliminando(true);
    try {
      await apiFetch(`/api/vehiculos/${porEliminar.id}`, { method: 'DELETE' });
      setVehiculos((actuales) => actuales?.filter((v) => v.id !== porEliminar.id) ?? actuales);
      setPorEliminar(null);
      toast.success('Vehículo eliminado');
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setEliminando(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Mis vehículos</h1>
        <Link href="/asegurado/vehiculos/nuevo" className={buttonClasses()}>
          <PlusCircle aria-hidden="true" className="h-4 w-4" />
          Registrar vehículo
        </Link>
      </div>

      <p className="text-muted-foreground text-sm">
        Registra los vehículos que quieres asegurar para reportar siniestros.
      </p>

      {error && <ErrorState mensaje={error} alReintentar={cargar} />}
      {vehiculos === null && !error && <LoadingState mensaje="Cargando tus vehículos…" />}

      {vehiculos?.length === 0 && (
        <EmptyState
          icono={<Car aria-hidden="true" className="h-8 w-8 text-muted-foreground" />}
          titulo="Aún no tienes vehículos"
          descripcion="Registra tu primer vehículo para poder reportar un siniestro."
          accion={
            <Link
              href="/asegurado/vehiculos/nuevo"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
            >
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              Registrar mi primer vehículo
            </Link>
          }
        />
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {vehiculos?.map((vehiculo) => (
          <li key={vehiculo.id}>
            <article className="h-full rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{vehiculo.matricula}</h2>
                  <p className="text-sm text-muted-foreground">
                    {vehiculo.marca} {vehiculo.modelo}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Póliza: <span className="font-medium text-foreground">{vehiculo.numeroPoliza}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/asegurado/vehiculos/${vehiculo.id}/editar`}
                  className={buttonClasses({ variant: 'outline', size: 'sm' })}
                >
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                  Editar
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPorEliminar(vehiculo)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </article>
          </li>
        ))}
      </ul>

      <Dialog open={porEliminar !== null} onOpenChange={(abierto) => !abierto && setPorEliminar(null)}>
        <DialogContent titulo="Eliminar vehículo">
          <p className="text-sm">
            ¿Seguro que quieres eliminar el vehículo{' '}
            <strong>{porEliminar?.matricula}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPorEliminar(null)} disabled={eliminando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarEliminacion} disabled={eliminando}>
              {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}