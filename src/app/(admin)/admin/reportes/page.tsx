import Link from 'next/link';
import { requirePortalUser } from '@/lib/auth/require-portal-user';
import {
  consultarEstadisticas,
  filtroReportes,
} from '@/infrastructure/repositories/report-queries';

export const dynamic = 'force-dynamic';

function etiqueta(valor: string) {
  const nombres: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    FAST_TRACK: 'Vía rápida',
    EN_REVISION: 'En revisión',
    APROBADO: 'Aprobado',
    RECHAZADO: 'Rechazado',
    FINALIZADO: 'Finalizado',
    VERDE: 'Verde',
    AMARILLA: 'Amarilla',
    ROJA: 'Roja',
    SIN_CLASIFICAR: 'Sin clasificar',
  };
  return nombres[valor] ?? valor;
}

export default async function ReportesAdmin({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePortalUser('ADMIN');
  const params = (await searchParams) ?? {};
  const parseado = filtroReportes.safeParse({
    desde: params.desde || undefined,
    hasta: params.hasta || undefined,
  });
  const datos = parseado.success ? await consultarEstadisticas(parseado.data) : null;
  const maximo = Math.max(1, ...(datos?.dias.map(([, cantidad]) => cantidad) ?? []));
  return (
    <section className="space-y-6">
      <header className="rounded-2xl bg-slate-900 p-7 text-white">
        <h1 className="text-3xl font-bold">Reportes generales</h1>
        <p className="mt-3 max-w-xl text-sm text-slate-300">
          Incidentes por fecha, estado actual y ruta de atención.
        </p>
      </header>
      <form className="flex flex-wrap items-end gap-4 rounded-xl border bg-white p-5">
        <label className="space-y-2 text-sm">
          <span className="block">Desde</span>
          <input
            type="date"
            name="desde"
            defaultValue={typeof params.desde === 'string' ? params.desde : ''}
            className="rounded-lg border p-2"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="block">Hasta</span>
          <input
            type="date"
            name="hasta"
            defaultValue={typeof params.hasta === 'string' ? params.hasta : ''}
            className="rounded-lg border p-2"
          />
        </label>
        <button className="rounded-lg bg-primary px-5 py-2 font-semibold text-white">
          Consultar
        </button>
        <Link href="/admin/reportes" className="px-2 py-2 text-primary underline">
          Ver todo
        </Link>
      </form>
      {!parseado.success && (
        <p role="alert" className="text-red-700">
          Revisa las fechas. Usa un rango válido con la fecha inicial anterior o igual a la final.
        </p>
      )}
      {datos && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Incidentes en el período', datos.total],
              ['Finalizados', datos.estados.find(([estado]) => estado === 'FINALIZADO')?.[1] ?? 0],
              ['En revisión', datos.estados.find(([estado]) => estado === 'EN_REVISION')?.[1] ?? 0],
            ].map(([titulo, cantidad]) => (
              <article key={titulo} className="rounded-xl border bg-white p-5">
                <h2 className="text-sm text-muted-foreground">{titulo}</h2>
                <p className="mt-2 text-3xl font-semibold">{cantidad}</p>
              </article>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Agrupado por fecha del incidente, en hora de Bolivia. Los estados y rutas reflejan su
            situación actual.
          </p>
          {!datos.total && (
            <p className="rounded-xl border bg-white p-5">
              No hay incidentes en el período seleccionado.
            </p>
          )}
          <section className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 text-lg font-semibold">Incidentes por fecha</h2>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Cantidad</th>
                    <th className="p-2">
                      <span className="sr-only">Distribución</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {datos.dias.map(([dia, cantidad]) => (
                    <tr key={dia} className="border-t">
                      <td className="p-2">{dia.split('-').reverse().join('/')}</td>
                      <td className="p-2">{cantidad}</td>
                      <td className="w-1/2 p-2">
                        <div
                          aria-hidden="true"
                          className="h-3 rounded bg-emerald-600"
                          style={{ width: (cantidad / maximo) * 100 + '%' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="grid gap-5 md:grid-cols-2">
            {(
              [
                ['Por estado', datos.estados],
                ['Por ruta', datos.rutas],
              ] as const
            ).map(([titulo, filas]) => (
              <section key={titulo} className="rounded-xl border bg-white p-5">
                <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
                <dl className="space-y-3">
                  {filas.map(([nombre, cantidad]) => (
                    <div key={nombre} className="flex justify-between border-b pb-2">
                      <dt>{etiqueta(nombre)}</dt>
                      <dd className="font-semibold">{cantidad}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
