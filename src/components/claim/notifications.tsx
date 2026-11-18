'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
type Notice = {
  id: string;
  siniestroId: string;
  titulo: string;
  creadoEn: string;
  leidoEn: string | null;
};
export function Notifications() {
  const [data, setData] = useState<{
    notificaciones: Notice[];
    pendientes: number;
    disponible: boolean;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.visibilityState === 'hidden') return;
      try {
        const result = await apiFetch<NonNullable<typeof data>>('/api/notificaciones');
        if (active) {
          setData(result);
          setError('');
        }
      } catch {
        if (active) setError('No pudimos actualizar los avisos.');
      }
    }
    void refresh();
    const interval = setInterval(() => void refresh(), 10000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  if (!data?.disponible)
    return error ? <p className="text-xs text-muted-foreground">{error}</p> : null;
  async function read(id: string) {
    try {
      await apiFetch('/api/notificaciones', { method: 'POST', body: { id } });
      setData((current) =>
        current
          ? {
              ...current,
              pendientes: Math.max(
                0,
                current.pendientes -
                  (current.notificaciones.find((n) => n.id === id)?.leidoEn ? 0 : 1),
              ),
              notificaciones: current.notificaciones.map((n) =>
                n.id === id ? { ...n, leidoEn: new Date().toISOString() } : n,
              ),
            }
          : current,
      );
    } catch {
      setError('No pudimos marcar el aviso como leído.');
    }
  }
  return (
    <section className="mb-4 rounded-xl border bg-card p-3">
      <Button
        variant="outline"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="lista-notificaciones"
      >
        <Bell className="mr-2 h-4 w-4" />
        Avisos ({data.pendientes} sin leer)
      </Button>
      {error && (
        <p role="status" className="mt-2 text-sm">
          {error}
        </p>
      )}
      {open && (
        <ul id="lista-notificaciones" className="mt-3 space-y-3">
          {data.notificaciones.length === 0 ? (
            <li className="text-sm text-muted-foreground">Todavía no tienes avisos.</li>
          ) : (
            data.notificaciones.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t pt-2"
              >
                <Link
                  className="text-sm underline"
                  href={'/asegurado/siniestros/' + n.siniestroId}
                  onClick={() => void read(n.id)}
                >
                  {n.titulo}
                </Link>
                {!n.leidoEn && (
                  <Button variant="outline" onClick={() => void read(n.id)}>
                    Marcar leído
                  </Button>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
