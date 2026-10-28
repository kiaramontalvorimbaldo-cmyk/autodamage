import type { Siniestro } from '@/domain/entities';

export type PasoTimeline = {
  clave: string;
  etiqueta: string;
  completado: boolean;
  actual: boolean;
};

export function calcularPasos(siniestro: Siniestro, estadoOrden?: string): PasoTimeline[] {
  const pasos: PasoTimeline[] = [
    { clave: 'reportado', etiqueta: 'Reportado', completado: true, actual: false },
    {
      clave: 'analizado',
      etiqueta: 'Analizado',
      completado: siniestro.analisisEstado === 'COMPLETADO',
      actual: siniestro.analisisEstado === 'EN_PROCESO',
    },
  ];

  const requiereRevision =
    siniestro.estado === 'EN_REVISION' ||
    siniestro.estado === 'APROBADO' ||
    siniestro.estado === 'RECHAZADO' ||
    (siniestro.estado === 'FINALIZADO' && siniestro.ruta !== 'VERDE');

  if (requiereRevision) {
    pasos.push({
      clave: 'revision',
      etiqueta: 'Revisión del perito',
      completado:
        siniestro.estado === 'APROBADO' ||
        siniestro.estado === 'RECHAZADO' ||
        siniestro.estado === 'FINALIZADO',
      actual: siniestro.estado === 'EN_REVISION',
    });
  }

  if (
    siniestro.estado === 'APROBADO' ||
    siniestro.estado === 'FINALIZADO' ||
    siniestro.estado === 'FAST_TRACK'
  ) {
    pasos.push({
      clave: 'aprobado',
      etiqueta: 'Aprobado',
      completado: true,
      actual: false,
    });
  }

  if (['FAST_TRACK', 'APROBADO', 'FINALIZADO'].includes(siniestro.estado)) {
    const finalizado = siniestro.estado === 'FINALIZADO';
    const recibida =
      ['RECIBIDO', 'EN_REPARACION', 'COMPLETADO'].includes(estadoOrden ?? '') || finalizado;
    pasos.push({
      clave: 'orden',
      etiqueta: estadoOrden || finalizado ? 'Orden emitida' : 'Asignación de taller',
      completado: recibida,
      actual: !recibida,
    });
    pasos.push({
      clave: 'reparacion',
      etiqueta: estadoOrden === 'RECIBIDO' ? 'Recibido en taller' : 'En reparación',
      completado: finalizado || estadoOrden === 'COMPLETADO',
      actual: !finalizado && (estadoOrden === 'RECIBIDO' || estadoOrden === 'EN_REPARACION'),
    });
  }

  if (['FAST_TRACK', 'APROBADO', 'FINALIZADO'].includes(siniestro.estado)) {
    pasos.push({
      clave: 'finalizado',
      etiqueta: 'Finalizado',
      completado: siniestro.estado === 'FINALIZADO',
      actual: false,
    });
  }

  return pasos;
}

export function ClaimTimeline({
  siniestro,
  estadoOrden,
}: {
  siniestro: Siniestro;
  estadoOrden?: string;
}) {
  const pasos = calcularPasos(siniestro, estadoOrden);

  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Progreso del siniestro">
      {pasos.map((paso, i) => (
        <li key={paso.clave} className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              paso.actual
                ? 'bg-blue-600 text-white'
                : paso.completado
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-500'
            }`}
            aria-current={paso.actual ? 'step' : undefined}
          >
            {paso.etiqueta}
          </span>
          {i < pasos.length - 1 && (
            <span className="text-gray-300" aria-hidden="true">
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
