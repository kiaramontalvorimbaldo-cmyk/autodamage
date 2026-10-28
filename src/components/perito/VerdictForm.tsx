'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { DictamenFinal } from '@/domain/types';

const OPCIONES: {
  valor: DictamenFinal;
  etiqueta: string;
  descripcion: string;
}[] = [
  {
    valor: 'APROBADO',
    etiqueta: 'Aprobar',
    descripcion: 'Confirma el diagnóstico y el presupuesto',
  },
  {
    valor: 'RECHAZADO',
    etiqueta: 'Rechazar',
    descripcion: 'El siniestro no procede',
  },
  {
    valor: 'AMPLIACION_REQUERIDA',
    etiqueta: 'Solicitar ampliación',
    descripcion: 'Falta evidencia; el caso sigue en revisión',
  },
];

/**
 * Formulario de dictamen del perito.
 * Validación: al rechazar, las observaciones son obligatorias.
 */
export function VerdictForm({
  onSubmit,
  enviando = false,
}: {
  onSubmit: (datos: {
    dictamenFinal: DictamenFinal;
    observacionesPerito: string | null;
    kilometraje: number | null;
  }) => void | Promise<void>;
  enviando?: boolean;
}) {
  const [dictamenFinal, setDictamenFinal] = useState<DictamenFinal>('APROBADO');
  const [observaciones, setObservaciones] = useState('');
  const [kilometraje, setKilometraje] = useState('');
  const [error, setError] = useState<string | null>(null);

  const requiereObservaciones =
    dictamenFinal === 'RECHAZADO' || dictamenFinal === 'AMPLIACION_REQUERIDA';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (requiereObservaciones && observaciones.trim().length === 0) {
      setError('Indica el motivo del rechazo o qué información debe ampliar el asegurado');
      return;
    }
    setError(null);
    const km = kilometraje.trim();
    void onSubmit({
      dictamenFinal,
      observacionesPerito: observaciones.trim() || null,
      kilometraje: km ? Number(km) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium text-gray-900">Dictamen</legend>
        <div className="mt-2 space-y-2">
          {OPCIONES.map((opcion) => (
            <label
              key={opcion.valor}
              className="flex items-start gap-2 rounded-md border border-gray-200 p-3"
            >
              <input
                type="radio"
                name="dictamen_final"
                value={opcion.valor}
                checked={dictamenFinal === opcion.valor}
                onChange={() => setDictamenFinal(opcion.valor)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">{opcion.etiqueta}</span>
                <span className="block text-xs text-gray-500">{opcion.descripcion}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="kilometraje" className="block text-sm font-medium text-gray-700">
          Kilometraje (opcional)
        </label>
        <input
          id="kilometraje"
          type="number"
          min="0"
          value={kilometraje}
          onChange={(e) => setKilometraje(e.target.value)}
          className="mt-1 w-40 rounded-md border border-gray-300 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="observaciones_perito" className="block text-sm font-medium text-gray-700">
          Observaciones{' '}
          {requiereObservaciones && <span className="text-red-600">(obligatorias)</span>}
        </label>
        <textarea
          id="observaciones_perito"
          rows={3}
          maxLength={2000}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {enviando ? 'Enviando…' : 'Registrar dictamen'}
      </button>
    </form>
  );
}
