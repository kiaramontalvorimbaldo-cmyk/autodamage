'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { VehicleForm } from '@/components/vehicle/vehicle-form';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api-client';
import { mensajeDeError } from '@/lib/user-messages';
import type { VehiculoInput } from '@/application/validations/vehicle';
import type { Vehiculo } from '@/domain/entities';

/**
 * Diálogo de alta de vehículo: el mismo formulario del formulario de página,
 * reutilizable desde el asistente de siniestro.
 */
export function VehicleDialog({
  abierto,
  alCambiarAbierto,
  alGuardar,
  valoresIniciales,
  titulo = 'Registrar vehículo',
}: {
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
  alGuardar?: (vehiculo: Vehiculo) => void;
  valoresIniciales?: Partial<Record<'matricula' | 'marca' | 'modelo' | 'numero_poliza', string>>;
  titulo?: string;
}) {
  const [guardando, setGuardando] = useState(false);

  async function guardar(valores: VehiculoInput) {
    setGuardando(true);
    try {
      const vehiculo = await apiFetch<Vehiculo>('/api/vehiculos', {
        method: 'POST',
        body: valores,
      });
      toast.success('Vehículo registrado');
      alCambiarAbierto(false);
      alGuardar?.(vehiculo);
    } catch (error) {
      toast.error(mensajeDeError(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={alCambiarAbierto}>
      <DialogContent titulo={titulo}>
        <VehicleForm
          valoresIniciales={valoresIniciales}
          alGuardar={guardar}
          guardando={guardando}
          textoBoton="Registrar vehículo"
        />
      </DialogContent>
    </Dialog>
  );
}