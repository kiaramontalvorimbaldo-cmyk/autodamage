import type { InspeccionPericial } from '@/domain/entities';

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' ? (valor as Record<string, unknown>) : {};
}

/** Presenta datos conservados del análisis, sin inventar explicaciones retrospectivas. */
export function AnalysisBasis({ inspeccion }: { inspeccion: InspeccionPericial | null }) {
  if (!inspeccion) return null;
  const ia = objeto(inspeccion.respuestaIa);
  const piezas = Array.isArray(ia.piezas_detectadas) ? ia.piezas_detectadas.map(objeto) : [];
  const estructurales = objeto(ia.indicadores_estructurales);
  return (
    <section
      className="space-y-3 rounded-2xl border bg-white p-5"
      aria-label="Fundamento del análisis"
    >
      <h2 className="font-semibold">¿En qué se basó el análisis?</h2>
      <p className="text-sm text-muted-foreground">
        Estos son los resultados guardados de las fotos. La IA propone el diagnóstico; el sistema
        calcula el presupuesto y la ruta. El dictamen final corresponde al perito.
      </p>
      {piezas.length ? (
        <ul className="space-y-2 text-sm">
          {piezas.map((p, i) => (
            <li key={i}>
              <strong>{String(p.codigo_pieza ?? 'Pieza')}</strong> · {String(p.accion ?? '')}
              {typeof p.imagen_indice === 'number' && ` · Foto ${p.imagen_indice + 1}`}
              {typeof p.confianza === 'number' && ` · Confianza ${Math.round(p.confianza * 100)}%`}
              {typeof p.evidencia_visible === 'string' && (
                <p className="mt-1 text-muted-foreground">
                  Evidencia descrita por la IA: {p.evidencia_visible}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm">No hay piezas detectadas en la respuesta guardada.</p>
      )}
      <p className="text-sm">
        Severidad propuesta: {inspeccion.nivelSeveridad ?? 'No disponible'}. Confianza global:{' '}
        {inspeccion.confianzaGlobal === null
          ? 'No disponible'
          : `${Math.round(inspeccion.confianzaGlobal * 100)}%`}
        .
      </p>
      {Object.entries(estructurales)
        .filter(([, v]) => v === true)
        .map(([k]) => (
          <p key={k} className="text-sm text-red-800">
            Indicio señalado: {k.replaceAll('_', ' ')}.
          </p>
        ))}
      <p className="text-sm">
        Recaptura:{' '}
        {ia.sospecha_recaptura === true
          ? 'la IA señaló una posible foto de pantalla o reproducción'
          : ia.sospecha_recaptura === false
            ? 'la IA no señaló indicios; esto no certifica autenticidad'
            : 'sin información guardada'}
        .
      </p>
      {typeof ia.motivo_recaptura === 'string' && (
        <p className="text-sm">Motivo indicado por la IA: {ia.motivo_recaptura}</p>
      )}
      <p className="text-sm">
        Presupuesto calculado con el baremo del sistema:{' '}
        {inspeccion.costoTotalEstimado?.toFixed(2) ?? 'No disponible'} USD. Los ajustes del perito
        pueden modificarlo.
      </p>
      {inspeccion.dictamenFinal && (
        <p className="text-sm">
          <strong>Dictamen del perito:</strong> {inspeccion.dictamenFinal}.{' '}
          {inspeccion.observacionesPerito}
        </p>
      )}
    </section>
  );
}
