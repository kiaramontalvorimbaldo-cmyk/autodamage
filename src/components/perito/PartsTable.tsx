'use client';

import type { Accion } from '@/domain/types';
import type { PiezaVista } from '@/lib/piezas-vista';

const ACCIONES: Accion[] = ['REPARAR', 'PINTAR', 'SUSTITUIR'];

const ETIQUETAS_ACCION: Record<Accion, string> = {
  REPARAR: 'Reparar',
  PINTAR: 'Pintar',
  SUSTITUIR: 'Sustituir',
};

/**
 * Tabla editable de piezas detectadas.
 * El perito puede cambiar la acción, el costo, aprobar/desaprobar
 * y añadir observaciones por pieza.
 */
export function PartsTable({
  piezas,
  onChange,
  soloLectura = false,
}: {
  piezas: PiezaVista[];
  onChange: (piezas: PiezaVista[]) => void;
  soloLectura?: boolean;
}) {
  const actualizar = (evaluacionId: string, cambios: Partial<PiezaVista>) => {
    onChange(piezas.map((p) => (p.evaluacionId === evaluacionId ? { ...p, ...cambios } : p)));
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-600">
              Pieza
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-600">
              Acción
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-gray-600">
              Costo (USD)
            </th>
            <th scope="col" className="px-3 py-2 text-center font-medium text-gray-600">
              Confianza
            </th>
            <th scope="col" className="px-3 py-2 text-center font-medium text-gray-600">
              Aprobada
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium text-gray-600">
              Observación
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {piezas.map((pieza) => (
            <tr key={pieza.evaluacionId}>
              <td className="px-3 py-2 font-medium text-gray-900">{pieza.codigoPieza}</td>
              <td className="px-3 py-2">
                <select
                  disabled={soloLectura}
                  aria-label={`Acción para ${pieza.codigoPieza}`}
                  value={pieza.accionRequerida}
                  onChange={(e) =>
                    actualizar(pieza.evaluacionId, {
                      accionRequerida: e.target.value as Accion,
                    })
                  }
                  className="rounded-md border border-gray-300 px-2 py-1"
                >
                  {ACCIONES.map((accion) => (
                    <option key={accion} value={accion}>
                      {ETIQUETAS_ACCION[accion]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 text-right">
                <input
                  disabled={soloLectura}
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label={`Costo para ${pieza.codigoPieza}`}
                  value={pieza.costoPiezaEstimado}
                  onChange={(e) =>
                    actualizar(pieza.evaluacionId, {
                      costoPiezaEstimado: Number(e.target.value) || 0,
                    })
                  }
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-right"
                />
              </td>
              <td className="px-3 py-2 text-center text-gray-600">
                {pieza.confianza === null ? '—' : `${Math.round(pieza.confianza * 100)}%`}
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  disabled={soloLectura}
                  type="checkbox"
                  aria-label={`Aprobar ${pieza.codigoPieza}`}
                  checked={pieza.aprobadoPorPerito}
                  onChange={(e) =>
                    actualizar(pieza.evaluacionId, {
                      aprobadoPorPerito: e.target.checked,
                    })
                  }
                  className="h-4 w-4"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  disabled={soloLectura}
                  type="text"
                  aria-label={`Observación para ${pieza.codigoPieza}`}
                  value={pieza.observacionPieza ?? ''}
                  placeholder="Opcional"
                  onChange={(e) =>
                    actualizar(pieza.evaluacionId, {
                      observacionPieza: e.target.value || null,
                    })
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
