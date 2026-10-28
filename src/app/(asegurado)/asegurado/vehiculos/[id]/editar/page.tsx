'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BackButton } from '@/components/layout/back-button';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/ui-extra/empty-state';
import { VehicleForm } from '@/components/vehicle/vehicle-form';
import { buttonClasses } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { mensajeDeError } from '@/lib/user-messages';
import type { VehiculoInput } from '@/application/validations/vehicle';
import type { Vehiculo } from '@/domain/entities';

export default function EditarVehiculoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    apiFetch<Vehiculo[]>(`/api/vehiculos`)
      .then((vehiculos) => {
        const encontrado = vehiculos.find((v) => v.id === id) ?? null;
        setVehiculo(encontrado);
        setCargando(false);
      })
      .catch((e: unknown) => {
        setError(mensajeDeError(e));
        setCargando(false);
      });
  }, [id]);

  useEffect(cargar, [cargar]);

  async function guardar(valores: VehiculoInput) {
    setGuardando(true);
    try {
      await apiFetch(`/api/vehiculos/${id}`, { method: 'PATCH', body: valores });
      toast.success('Vehículo actualizado');
      router.push('/asegurado/vehiculos');
      router.refresh();
    } catch (error) {
      toast.error(mensajeDeError(error));
      setGuardando(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg space-y-4">
      <Breadcrumbs
        migas={[
          { etiqueta: 'Inicio', href: '/asegurado' },
          { etiqueta: 'Mis vehículos', href: '/asegurado/vehiculos' },
          { etiqueta: 'Editar vehículo' },
        ]}
      />
      <BackButton fallbackHref="/asegurado/vehiculos" />
      <h1 className="text-xl font-semibold">Editar vehículo</h1>

      {cargando && <LoadingState mensaje="Cargando el vehículo…" />}
      {error && <ErrorState mensaje={error} alReintentar={cargar} />}

      {!cargando && !error && !vehiculo && (
        <EmptyState
          titulo="No encontramos ese vehículo"
          descripcion="Puede que se haya eliminado. Revisa tu lista de vehículos."
          accion={
            <Link href="/asegurado/vehiculos" className={buttonClasses()}>
              Ir a mis vehículos
            </Link>
          }
        />
      )}

      {vehiculo && (
        <>
          <VehicleForm
            valoresIniciales={{
              matricula: vehiculo.matricula,
              marca: vehiculo.marca,
              modelo: vehiculo.modelo,
              numero_poliza: vehiculo.numeroPoliza,
            }}
            alGuardar={guardar}
            guardando={guardando}
            textoBoton="Guardar cambios"
          />
          <div className="flex gap-2 border-t pt-4">
            <Link href="/asegurado/vehiculos" className={buttonClasses({ variant: 'outline' })}>
              Cancelar
            </Link>
            <BackButton fallbackHref="/asegurado/vehiculos" />
          </div>
        </>
      )}
    </section>
  );
}