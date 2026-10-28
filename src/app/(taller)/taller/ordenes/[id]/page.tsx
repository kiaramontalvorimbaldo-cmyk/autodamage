'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { apiFetch, ApiError } from '@/lib/api-client';
import { formatCurrencyUsd } from '@/lib/format';
import type { EvaluacionDanos, Orden, Vehiculo } from '@/domain/entities';

const SIGUIENTE: Record<string, { estado: string; etiqueta: string } | null> = {
  EMITIDA: { estado: 'RECIBIDO', etiqueta: 'Marcar como recibido' },
  RECIBIDO: { estado: 'EN_REPARACION', etiqueta: 'Comenzar reparación' },
  EN_REPARACION: { estado: 'COMPLETADO', etiqueta: 'Completar reparación' },
  COMPLETADO: null,
};

type Detalle = {
  orden: Orden;
  vehiculo: Vehiculo | null;
  siniestro: {
    id: string;
    descripcion: string | null;
    estado: string;
    ruta: string | null;
  } | null;
  piezas: EvaluacionDanos[];
  imagenes: { id: string; url: string }[];
};

export default function DetalleOrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  function cargar() {
    apiFetch<Detalle>(`/api/ordenes/${id}`)
      .then(setDetalle)
      .catch(() => setError('No se pudo cargar la orden'));
  }

  useEffect(cargar, [id]);

  if (error) return <ErrorState mensaje={error} />;
  if (!detalle) return <LoadingState />;

  const siguiente = SIGUIENTE[detalle.orden.estado];

  async function avanzar() {
    if (!siguiente) return;
    setEnviando(true);
    setError(null);
    try {
      await apiFetch(`/api/ordenes/${id}/estado`, {
        method: 'PATCH',
        body: { estado: siguiente.estado },
      });
      setConfirmando(false);
      cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al actualizar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="space-y-4">
      <Link href="/taller/ordenes" className="text-sm text-blue-600">
        ← Órdenes
      </Link>
      <h1 className="text-xl font-semibold">Orden {id.slice(0, 8)}</h1>
      <p className="text-sm text-gray-600">
        Estado: <strong>{detalle.orden.estado}</strong> · Monto:{' '}
        {formatCurrencyUsd(detalle.orden.montoAutorizado)}
      </p>
      {detalle.vehiculo && (
        <p className="text-sm text-gray-700">
          Vehículo: {detalle.vehiculo.marca} {detalle.vehiculo.modelo} —{' '}
          {detalle.vehiculo.matricula}
        </p>
      )}
      {detalle.siniestro?.descripcion && (
        <p className="text-sm text-gray-700">{detalle.siniestro.descripcion}</p>
      )}

      <section>
        <h2 className="text-sm font-semibold">Piezas aprobadas</h2>
        <table className="mt-2 min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600">
              <th className="py-1 pr-4">Pieza</th>
              <th className="py-1 pr-4">Acción</th>
              <th className="py-1 pr-4">Costo</th>
            </tr>
          </thead>
          <tbody>
            {detalle.piezas.map((p) => (
              <tr key={p.id}>
                <td className="py-1 pr-4">{p.codigoPieza}</td>
                <td className="py-1 pr-4">{p.accionRequerida}</td>
                <td className="py-1 pr-4">{formatCurrencyUsd(p.costoPiezaEstimado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ul className="grid grid-cols-3 gap-2">
        {detalle.imagenes.map((img) => (
          <li key={img.id}>
            {}
            <img src={img.url} alt="Evidencia" className="h-24 w-full rounded-md object-cover" />
          </li>
        ))}
      </ul>

      {siguiente && !confirmando && (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white"
        >
          {siguiente.etiqueta}
        </button>
      )}
      {confirmando && (
        <div className="flex items-center gap-2">
          <p className="text-sm">¿Confirmar «{siguiente?.etiqueta}»?</p>
          <button
            type="button"
            onClick={avanzar}
            disabled={enviando}
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Sí
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            No
          </button>
        </div>
      )}
    </main>
  );
}
