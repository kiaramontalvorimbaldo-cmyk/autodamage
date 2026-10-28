'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Car, ClipboardList, FileText, Home, PlusCircle, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatName, rolLabel } from '@/lib/format';
import type { Rol } from '@/domain/types';
import { Brand } from '@/components/brand';

type ItemNav = {
  href: string;
  etiqueta: string;
  icono: typeof Home;
  exacto?: boolean;
};

const INICIO: ItemNav = { href: '/', etiqueta: 'Inicio', icono: Home, exacto: true };

const ITEMS_POR_ROL: Record<Rol, ItemNav[]> = {
  ASEGURADO: [
    { ...INICIO, href: '/asegurado' },
    { href: '/asegurado/nuevo-siniestro', etiqueta: 'Reportar siniestro', icono: PlusCircle },
    { href: '/asegurado/siniestros', etiqueta: 'Mis siniestros', icono: FileText },
    { href: '/asegurado/vehiculos', etiqueta: 'Mis vehículos', icono: Car },
  ],
  PERITO: [{ ...INICIO, href: '/perito' }],
  TALLER: [
    { ...INICIO, href: '/taller' },
    { href: '/taller/ordenes', etiqueta: 'Órdenes de trabajo', icono: Wrench },
  ],
  ADMIN: [
    { ...INICIO, href: '/admin' },
    { href: '/admin/casos', etiqueta: 'Casos', icono: FileText },
    { href: '/admin/personal', etiqueta: 'Personal', icono: ClipboardList },
    { href: '/admin/auditoria', etiqueta: 'Auditoría', icono: FileText },
  ],
};

const INICIO_POR_ROL: Record<Rol, string> = {
  ASEGURADO: '/asegurado',
  PERITO: '/perito',
  TALLER: '/taller',
  ADMIN: '/admin',
};

function esActivo(item: ItemNav, pathname: string): boolean {
  if (item.exacto) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Cáscara de portal: navegación persistente por rol.
 * - Escritorio (≥ md): barra lateral con logo, ítems y "Cerrar sesión".
 * - Móvil: barra superior con logo y barra inferior fija con los ítems.
 */
export function PortalShell({
  rol,
  nombre,
  children,
}: {
  rol: Rol;
  nombre?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  const items = ITEMS_POR_ROL[rol];
  const inicio = INICIO_POR_ROL[rol];
  const nombreFormateado = formatName(nombre);

  async function handleLogout(event: FormEvent) {
    event.preventDefault();
    setSaliendo(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Barra lateral (escritorio) */}
      <aside className="portal-sidebar sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r p-5 md:flex">
        <Link href={inicio} className="flex items-center gap-2 text-base font-semibold">
          <Brand inverse />
        </Link>
        {nombreFormateado && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="truncate text-sm font-medium text-white">{nombreFormateado}</p>
            <p className="mt-1 text-xs text-slate-400">{rolLabel(rol)}</p>
          </div>
        )}
        <nav aria-label="Navegación principal" className="mt-4 flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const Icono = item.icono;
            const activo = esActivo(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={activo ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  activo
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icono aria-hidden="true" className="h-4 w-4" />
                {item.etiqueta}
              </Link>
            );
          })}
        </nav>
        <form onSubmit={handleLogout}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={saliendo}
            className="w-full border-white/15 bg-transparent text-slate-300 hover:bg-white/10 hover:text-white"
          >
            {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Button>
        </form>
      </aside>

      {/* Cabecera (móvil) */}
      <header className="sticky top-0 z-20 border-b bg-card md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href={inicio} className="flex items-center gap-2 text-base font-semibold">
            <Brand />
          </Link>
          {nombreFormateado && (
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{nombreFormateado}</p>
              <p className="text-xs text-muted-foreground">{rolLabel(rol)}</p>
            </div>
          )}
        </div>
      </header>

      {/* Contenido con espacio para la barra inferior en móvil */}
      <div className="portal-content min-w-0 flex-1 pb-20 md:pb-0">
        <div className="portal-topbar hidden md:flex">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Tu espacio · {rolLabel(rol)}
          </span>
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> AutoDamage AI
          </span>
        </div>
        <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">{children}</div>
      </div>

      {/* Barra inferior (móvil) */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-card md:hidden"
      >
        <ul className="flex items-stretch justify-around">
          {items.map((item) => {
            const Icono = item.icono;
            const activo = esActivo(item, pathname);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={activo ? 'page' : undefined}
                  className={`flex flex-col items-center gap-0.5 px-1 py-2 text-xs ${
                    activo ? 'font-semibold text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <Icono aria-hidden="true" className="h-5 w-5" />
                  <span className="text-center leading-tight">{item.etiqueta}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <form onSubmit={handleLogout}>
              <button
                type="submit"
                disabled={saliendo}
                className="flex w-full flex-col items-center gap-0.5 px-1 py-2 text-xs text-muted-foreground disabled:opacity-50"
              >
                <ClipboardList aria-hidden="true" className="h-5 w-5" />
                <span className="leading-tight">{saliendo ? 'Saliendo…' : 'Salir'}</span>
              </button>
            </form>
          </li>
        </ul>
      </nav>
    </div>
  );
}
