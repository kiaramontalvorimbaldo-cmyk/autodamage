import Link from 'next/link';
import { z } from 'zod';
import { requirePortalUser } from '@/lib/auth/require-portal-user';
import { consultarAdministracion } from '@/infrastructure/repositories/admin-queries';

export const dynamic = 'force-dynamic';
export default async function ReportesAdmin() {
  await requirePortalUser('ADMIN');
  const datos = await consultarAdministracion();
  const casos = z
    .array(
      z.object({
        id: z.string().uuid(),
        estado: z.string(),
        ruta: z.string().nullable(),
        descripcion: z.string().nullable(),
      }),
    )
    .parse(datos.casos);
  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-slate-900 p-7 text-white">
        <p className="text-xs uppercase tracking-widest text-emerald-200">
          Documentación de siniestros
        </p>
        <h1 className="mt-2 text-3xl font-bold">Centro de reportes</h1>
        <p className="mt-3 max-w-xl text-sm text-slate-300">
          Expedientes con identificación, valoración de daños, fundamento del análisis, dictamen,
          reparación y evidencias. Abre un informe para imprimirlo o guardarlo como PDF.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Se muestran los últimos 100 casos por fecha del incidente. Cada informe consulta el detalle
        actual del expediente.
      </p>
      <div className="space-y-3">
        {casos.map((c) => (
          <article
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-5"
          >
            <div>
              <h2 className="font-semibold">Siniestro {c.id.slice(0, 8)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {c.estado.replaceAll('_', ' ')} · Ruta {c.ruta ?? 'pendiente'}
              </p>
              <p className="mt-2 max-w-xl text-sm">{c.descripcion || 'Sin descripción'}</p>
            </div>
            <Link
              href={`/admin/reportes/${c.id}`}
              className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800"
            >
              Abrir informe
            </Link>
          </article>
        ))}
        {!casos.length && (
          <p className="rounded-xl border bg-white p-6">
            Todavía no hay siniestros para emitir reportes.
          </p>
        )}
      </div>
    </section>
  );
}
