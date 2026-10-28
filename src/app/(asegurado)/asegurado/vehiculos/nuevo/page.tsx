'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { VehicleForm } from '@/components/vehicle/vehicle-form';
import { buttonClasses } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { mensajeDeError } from '@/lib/user-messages';
import type { VehiculoInput } from '@/application/validations/vehicle';

export default function NuevoVehiculoPage() {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);

  async function guardar(valores: VehiculoInput) {
    setGuardando(true);
    try {
      await apiFetch('/api/vehiculos', { method: 'POST', body: valores });
      toast.success('Vehículo registrado');
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
          { etiqueta: 'Registrar vehículo' },
        ]}
      />
      <h1 className="text-xl font-semibold">Registrar vehículo</h1>
      <p className="text-muted-foreground text-sm">
        Escribe los datos tal como aparecen en tu documento de propiedad.
      </p>

      <VehicleForm alGuardar={guardar} guardando={guardando} textoBoton="Registrar vehículo" />

      <div className="flex gap-2 border-t pt-4">
        <Link href="/asegurado/vehiculos" className={buttonClasses({ variant: 'outline' })}>
          Cancelar
        </Link>
        <Link href="/asegurado" className={buttonClasses({ variant: 'ghost' })}>
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}