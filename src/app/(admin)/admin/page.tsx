import Link from 'next/link';
import { ArrowUpRight, Files, ScanLine, ScrollText, UsersRound } from 'lucide-react';
export default function AdminPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          CENTRO DE OPERACIONES
        </p>
        <h1 className="text-3xl font-bold">Administración</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Una visión completa para acompañar cada caso.
        </p>
      </div>
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-7 text-white sm:p-10">
        <ScanLine
          className="absolute -right-5 -top-5 h-56 w-56 rotate-12 text-emerald-200/10"
          aria-hidden="true"
        />
        <p className="relative mb-4 text-xs font-medium uppercase tracking-[0.16em] text-emerald-200">
          Personas, procesos y confianza
        </p>
        <h2 className="relative max-w-sm text-3xl font-semibold leading-tight tracking-tight">
          Cada detalle cuenta.
          <br />
          <span className="text-emerald-200">Cada decisión, también.</span>
        </h2>
        <p className="relative mt-4 max-w-md text-sm leading-6 text-slate-300">
          Este es tu punto de partida para la consulta de casos, la gestión del equipo y el
          historial de decisiones.
        </p>
      </div>
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Tu espacio de trabajo</h2>
          <span className="rounded-full border bg-white px-3 py-1 text-[11px] text-slate-500">
            Consulta y gestión
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              href: '/admin/casos',
              titulo: 'Casos',
              descripcion: 'El panorama de los siniestros y su atención.',
              icon: Files,
            },
            {
              href: '/admin/personal',
              titulo: 'Personal',
              descripcion: 'Las personas que hacen posible cada solución.',
              icon: UsersRound,
            },
            {
              href: '/admin/auditoria',
              titulo: 'Auditoría',
              descripcion: 'El historial detrás de cada decisión.',
              icon: ScrollText,
            },
          ].map(({ href, titulo, descripcion, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border bg-white p-6 shadow-sm transition-colors hover:border-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <ArrowUpRight
                  className="h-4 w-4 text-slate-400 group-hover:text-emerald-700"
                  aria-hidden="true"
                />
              </div>
              <h3 className="font-semibold">{titulo}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{descripcion}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
