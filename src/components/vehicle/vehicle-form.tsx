'use client';

import { useId } from 'react';
import { useForm, useController, type Control, type FieldError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { vehiculoSchema, type VehiculoInput } from '@/application/validations/vehicle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Campo = 'matricula' | 'marca' | 'modelo' | 'numero_poliza';

const CAMPOS: { nombre: Campo; etiqueta: string; ayuda?: string }[] = [
  { nombre: 'matricula', etiqueta: 'Matrícula', ayuda: 'Se convierte a mayúsculas automáticamente.' },
  { nombre: 'marca', etiqueta: 'Marca' },
  { nombre: 'modelo', etiqueta: 'Modelo' },
  { nombre: 'numero_poliza', etiqueta: 'Número de póliza' },
];

function CampoVehiculo({
  control,
  nombre,
  etiqueta,
  ayuda,
  uid,
  error,
  deshabilitado,
}: {
  control: Control<VehiculoInput>;
  nombre: Campo;
  etiqueta: string;
  ayuda?: string;
  uid: string;
  error?: FieldError;
  deshabilitado: boolean;
}) {
  const { field } = useController({ control, name: nombre });
  const idCampo = `${uid}-${nombre}`;
  const esMatricula = nombre === 'matricula';

  return (
    <div className="space-y-1">
      <Label htmlFor={idCampo}>{etiqueta}</Label>
      <Input
        {...field}
        id={idCampo}
        name={nombre}
        autoComplete="off"
        value={esMatricula ? field.value.toUpperCase() : field.value}
        onChange={(evento) =>
          field.onChange(esMatricula ? evento.target.value.toUpperCase() : evento.target.value)
        }
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${idCampo}-error` : ayuda ? `${idCampo}-ayuda` : undefined
        }
        disabled={deshabilitado}
      />
      {error && (
        <p id={`${idCampo}-error`} role="alert" className="text-destructive text-sm">
          {error.message}
        </p>
      )}
      {!error && ayuda && (
        <p id={`${idCampo}-ayuda`} className="text-muted-foreground text-xs">
          {ayuda}
        </p>
      )}
    </div>
  );
}

/**
 * Formulario de vehículo (React Hook Form + Zod).
 * Reutilizable en páginas y dentro del diálogo del asistente.
 */
export function VehicleForm({
  valoresIniciales,
  alGuardar,
  guardando = false,
  textoBoton = 'Guardar vehículo',
  idVehiculo,
}: {
  valoresIniciales?: Partial<Record<Campo, string>>;
  alGuardar: (valores: VehiculoInput) => void | Promise<void>;
  guardando?: boolean;
  textoBoton?: string;
  idVehiculo?: string;
}) {
  const uid = useId();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<VehiculoInput>({
    resolver: zodResolver(vehiculoSchema),
    defaultValues: {
      matricula: valoresIniciales?.matricula ?? '',
      marca: valoresIniciales?.marca ?? '',
      modelo: valoresIniciales?.modelo ?? '',
      numero_poliza: valoresIniciales?.numero_poliza ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(alGuardar)} noValidate className="space-y-4">
      {CAMPOS.map(({ nombre, etiqueta, ayuda }) => (
        <CampoVehiculo
          key={nombre}
          control={control}
          nombre={nombre}
          etiqueta={etiqueta}
          ayuda={ayuda}
          uid={uid}
          error={errors[nombre]}
          deshabilitado={guardando}
        />
      ))}

      {guardando && (
        <p role="status" className="text-muted-foreground text-sm">
          Guardando tus datos…
        </p>
      )}

      <Button type="submit" disabled={guardando} className="w-full">
        {guardando ? 'Guardando…' : textoBoton}
      </Button>

      {idVehiculo && (
        <p className="text-muted-foreground text-xs">Editando el vehículo {idVehiculo}</p>
      )}
    </form>
  );
}