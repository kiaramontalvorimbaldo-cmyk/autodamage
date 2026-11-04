import type { ReactNode } from 'react';
import type { DetalleSiniestro } from '@/application/use-cases/get-claim';
import type { RegistroAuditoria } from '@/application/ports/audit-repository';
import { AnalysisBasis } from '@/components/analysis-basis';

export type IdentificacionReporte = {
  asegurado: string | null;
  matricula: string | null;
  marca: string | null;
  modelo: string | null;
  poliza: string | null;
};
export const fechaReporte = (v: string) =>
  new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/La_Paz',
  }).format(new Date(v));
const dinero = (v: number | null | undefined) =>
  v == null ? 'No registrado' : `${v.toFixed(2)} USD`;
function Campo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{titulo}</dt>
      <dd className="mt-1 break-words font-medium">{children ?? 'No registrado'}</dd>
    </div>
  );
}
function Bloque({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="report-section space-y-4 border-t border-slate-200 pt-5">
      <h2 className="text-lg font-bold text-slate-900">
        <span className="mr-3 text-emerald-700">{numero}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export function ClaimReport({
  detalle,
  identificacion,
  registros,
  emitidoEn,
  emitidoPor,
}: {
  detalle: DetalleSiniestro;
  identificacion: IdentificacionReporte;
  registros: RegistroAuditoria[];
  emitidoEn: string;
  emitidoPor: string;
}) {
  const s = detalle.siniestro;
  if (!s) return null;
  const i = detalle.inspeccion;
  return (
    <article className="insurance-report space-y-7 rounded-2xl border bg-white p-6 text-sm text-slate-800 shadow-sm sm:p-10">
      <header className="flex flex-wrap justify-between gap-5 border-b-4 border-emerald-700 pb-6">
        <div>
          <p className="text-xl font-extrabold text-slate-950">
            AutoDamage <span className="text-emerald-700">AI</span>
          </p>
          <p className="mt-4 text-xs uppercase tracking-[.2em] text-slate-500">
            Gestión de siniestros · Uso confidencial
          </p>
          <h1 className="mt-2 text-2xl font-bold">Informe técnico de siniestro</h1>
        </div>
        <div className="max-w-xs text-xs">
          <p className="font-semibold">EXPEDIENTE {s.id}</p>
          <p className="mt-2">Emitido: {fechaReporte(emitidoEn)} (Bolivia)</p>
          <p>Emisor: {emitidoPor}</p>
          <p>Versión de formato: 1.0</p>
        </div>
      </header>
      <div className="grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-3">
        <Campo titulo="Estado del expediente">{s.estado.replaceAll('_', ' ')}</Campo>
        <Campo titulo="Ruta de atención">{s.ruta ?? 'Pendiente'}</Campo>
        <Campo titulo="Estimación registrada">{dinero(i?.costoTotalEstimado)}</Campo>
      </div>
      <Bloque numero="01" titulo="Identificación del asegurado y del vehículo">
        <dl className="grid gap-5 sm:grid-cols-2">
          <Campo titulo="Asegurado">{identificacion.asegurado}</Campo>
          <Campo titulo="Póliza registrada">{identificacion.poliza}</Campo>
          <Campo titulo="Matrícula">{identificacion.matricula}</Campo>
          <Campo titulo="Marca / modelo">
            {[identificacion.marca, identificacion.modelo].filter(Boolean).join(' ') || null}
          </Campo>
        </dl>
      </Bloque>
      <Bloque numero="02" titulo="Antecedentes del incidente">
        <dl className="grid gap-5 sm:grid-cols-2">
          <Campo titulo="Fecha del incidente">{fechaReporte(s.fechaIncidente)}</Campo>
          <Campo titulo="Fecha de registro">{fechaReporte(s.fechaRegistro)}</Campo>
          <Campo titulo="Coordenadas declaradas">
            {s.latitud}, {s.longitud}
          </Campo>
          <Campo titulo="Inspección presencial requerida">
            {s.requiereInspeccionPresencial ? 'Sí' : 'No'}
          </Campo>
        </dl>
        <p className="whitespace-pre-wrap">{s.descripcion || 'Sin descripción registrada.'}</p>
      </Bloque>
      <Bloque numero="03" titulo="Evaluación técnica y fundamento">
        <p>
          Análisis: {s.analisisEstado.replaceAll('_', ' ')} · Modelo:{' '}
          {i?.modeloIa ?? 'No registrado'} · Prompt: {i?.versionPrompt ?? 'No registrado'}
        </p>
        {i ? (
          <AnalysisBasis inspeccion={i} />
        ) : (
          <p>Evaluación pendiente. No hay resultado técnico registrado.</p>
        )}
        <p>
          Indicadores de control:{' '}
          {i?.indicadoresFraude.length
            ? i.indicadoresFraude.join(', ').replaceAll('_', ' ')
            : 'Sin indicadores registrados'}
          . Etiquetas:{' '}
          {s.etiquetas.length ? s.etiquetas.join(', ').replaceAll('_', ' ') : 'Sin etiquetas'}.
        </p>
      </Bloque>
      <Bloque numero="04" titulo="Detalle de valoración">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white">
              <tr>
                {[
                  'Pieza',
                  'Intervención',
                  'Horas MO',
                  'Importe registrado',
                  'Validación perito',
                ].map((t) => (
                  <th key={t} className="p-3">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detalle.evaluaciones.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="p-3">
                    {e.codigoPieza.replaceAll('_', ' ')}
                    {e.observacionPieza && <p>{e.observacionPieza}</p>}
                  </td>
                  <td className="p-3">{e.accionRequerida}</td>
                  <td className="p-3">{e.horasManoObra}</td>
                  <td className="p-3">{dinero(e.costoPiezaEstimado)}</td>
                  <td className="p-3">{e.aprobadoPorPerito ? 'Sí' : 'Sin aprobación'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!detalle.evaluaciones.length && <p>Sin partidas de daños registradas.</p>}
        <p className="text-right font-bold">
          Total estimado registrado: {dinero(i?.costoTotalEstimado)}
        </p>
        <p className="text-xs text-slate-500">
          Importes en USD. Se muestran los valores guardados en el expediente; no se añaden
          impuestos, deducibles ni coberturas no registradas.
        </p>
      </Bloque>
      <Bloque numero="05" titulo="Dictamen y seguimiento de reparación">
        <dl className="grid gap-5 sm:grid-cols-2">
          <Campo titulo="Dictamen del perito">
            {i?.dictamenFinal?.replaceAll('_', ' ') ?? 'Pendiente de dictamen humano'}
          </Campo>
          <Campo titulo="Referencia del perito">{i?.peritoId ?? 'Sin perito registrado'}</Campo>
          <Campo titulo="Taller asignado">{detalle.taller?.nombre}</Campo>
          <Campo titulo="Orden de trabajo">{detalle.orden?.id}</Campo>
          <Campo titulo="Estado de la orden">{detalle.orden?.estado.replaceAll('_', ' ')}</Campo>
          <Campo titulo="Monto autorizado">{dinero(detalle.orden?.montoAutorizado)}</Campo>
        </dl>
        <p className="whitespace-pre-wrap">
          Observaciones del perito: {i?.observacionesPerito || 'Sin observaciones registradas.'}
        </p>
        <p className="text-xs text-slate-500">
          La clasificación automática y la emisión de una orden no equivalen a un dictamen firmado
          por un perito. Este documento no incorpora firma digital.
        </p>
      </Bloque>
      <Bloque numero="06" titulo="Anexo fotográfico">
        <div className="grid gap-5 sm:grid-cols-2">
          {detalle.imagenes.map((f, n) => (
            <figure key={f.id} className="report-photo rounded-lg border p-3">
              {/* Evidencias firmadas privadas; no se optimizan ni se almacenan en caché de imágenes. */}
              <img
                src={f.url}
                alt={`Evidencia del siniestro ${n + 1}`}
                loading="eager"
                className="h-52 w-full rounded object-contain"
              />
              <figcaption className="mt-2 text-xs">
                Foto {n + 1} · {fechaReporte(f.capturadaEn)}
                <br />
                Ref. {f.id}
              </figcaption>
            </figure>
          ))}
        </div>
        {!detalle.imagenes.length && <p>Sin evidencias fotográficas registradas.</p>}
      </Bloque>
      <Bloque numero="07" titulo="Trazabilidad del expediente">
        <ol className="space-y-3">
          {registros.map((r) => (
            <li key={r.id} className="report-event border-l-2 border-emerald-200 pl-3">
              <strong>{r.accion.replaceAll('_', ' ')}</strong>
              <p className="text-xs text-slate-500">
                {fechaReporte(r.creadoEn)} · Actor: {r.actorTipo} · Ref. {r.id}
              </p>
            </li>
          ))}
        </ol>
        {!registros.length && <p>Sin eventos registrados.</p>}
      </Bloque>
      <footer className="border-t pt-4 text-xs leading-5 text-slate-500">
        Documento generado desde los datos disponibles al momento de emisión. La póliza se
        identifica por su número registrado; no certifica su vigencia ni la cobertura del evento.
        Las conclusiones automáticas conservan su carácter de apoyo a la evaluación humana. Uso
        interno y confidencial · AutoDamage AI · {s.id}
      </footer>
    </article>
  );
}
