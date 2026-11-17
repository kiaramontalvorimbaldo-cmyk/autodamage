'use client';

import { useEffect, useRef, useState } from 'react';
import type { CoordinacionCaso } from '@/application/ports/case-coordination';
import { apiFetch } from '@/lib/api-client';

type Props = { siniestroId: string; rol: 'TALLER' | 'PERITO'; completado?: boolean };

export function CaseCoordination({ siniestroId, rol, completado = false }: Props) {
  const [datos, setDatos] = useState<CoordinacionCaso | null>(null);
  const [antes, setAntes] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [fecha, setFecha] = useState('');
  const [editandoFecha, setEditandoFecha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const intento = useRef<{ id: string; contenido: string } | null>(null);
  const fechaAnterior = useRef<string | null>(null);
  const endpoint = `/api/siniestros/${siniestroId}/coordinacion`;

  useEffect(() => {
    let cancelado = false;
    let siguiente: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function cargar() {
      try {
        if (!document.hidden) {
          const valor = await apiFetch<CoordinacionCaso>(
            endpoint + (antes ? `?antes=${antes}` : ''),
            { signal: controller.signal },
          );
          if (!cancelado) {
            setDatos(valor);
            setError('');
          }
        }
      } catch (e) {
        if (!cancelado)
          setError(e instanceof Error ? e.message : 'No se pudo cargar la conversación.');
      } finally {
        if (!cancelado) siguiente = setTimeout(cargar, 5000);
      }
    }
    void cargar();
    return () => {
      cancelado = true;
      clearTimeout(siguiente);
      controller.abort();
    };
  }, [endpoint, antes, version]);

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    const contenido = texto.trim();
    if (!contenido || enviando) return;
    if (intento.current?.contenido !== contenido)
      intento.current = { id: crypto.randomUUID(), contenido };
    setEnviando(true);
    setError('');
    setAviso('');
    try {
      await apiFetch(endpoint, { method: 'POST', body: { tipo: 'mensaje', ...intento.current } });
      intento.current = null;
      setTexto('');
      setAntes(null);
      setVersion((v) => v + 1);
      setAviso('Mensaje enviado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se confirmó el envío.');
    } finally {
      setEnviando(false);
    }
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    if (!datos || guardando) return;
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      await apiFetch(endpoint, {
        method: 'POST',
        body: { tipo: 'entrega', fecha, anterior: fechaAnterior.current },
      });
      setEditandoFecha(false);
      setVersion((v) => v + 1);
      setAviso('Fecha estimada de entrega guardada.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se confirmó la fecha de entrega.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section
      className="space-y-5 rounded-2xl border bg-white p-5 sm:p-6"
      aria-label="Coordinación del caso"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Conversación del caso</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Comparte hallazgos y coordina la reparación con{' '}
            {rol === 'TALLER' ? 'el perito' : 'el taller'}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditandoFecha(false);
            setVersion((v) => v + 1);
          }}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          Actualizar
        </button>
      </div>

      <div className="rounded-xl bg-emerald-50 p-4">
        <h3 className="text-sm font-semibold">Fecha estimada de entrega</h3>
        <p className="mt-1">
          {datos
            ? (datos.fechaEntrega?.split('-').reverse().join('/') ?? 'Por definir por el taller')
            : 'Consultando…'}
        </p>
        {rol === 'TALLER' && datos && !completado && (
          <form onSubmit={guardar} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              Entrega estimada
              <input
                type="date"
                required
                value={editandoFecha ? fecha : (datos.fechaEntrega ?? '')}
                disabled={guardando}
                onChange={(e) => {
                  if (!editandoFecha) fechaAnterior.current = datos.fechaEntrega;
                  setFecha(e.target.value);
                  setEditandoFecha(true);
                }}
                className="block rounded-lg border bg-white px-3 py-2"
              />
            </label>
            <button
              disabled={!editandoFecha || !fecha || guardando}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Guardar fecha'}
            </button>
          </form>
        )}
      </div>

      {!datos && !error && <p role="status">Cargando conversación…</p>}
      {datos && (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            {datos.antes && (
              <button type="button" onClick={() => setAntes(datos.antes)} className="underline">
                Ver mensajes anteriores
              </button>
            )}
            {antes && (
              <button type="button" onClick={() => setAntes(null)} className="underline">
                Volver a recientes
              </button>
            )}
          </div>
          <ol className="max-h-96 space-y-3 overflow-y-auto" aria-label="Mensajes del caso">
            {datos.mensajes.map((mensaje) => (
              <li
                key={mensaje.id}
                className={`rounded-xl border p-3 ${mensaje.rol === rol ? 'ml-4 border-emerald-200 bg-emerald-50' : 'mr-4 bg-slate-50'}`}
              >
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {mensaje.nombre} · {mensaje.rol === 'TALLER' ? 'Taller' : 'Perito'}
                  </span>
                  <time dateTime={mensaje.fecha}>
                    {new Date(mensaje.fecha).toLocaleString('es-BO', {
                      timeZone: 'America/La_Paz',
                    })}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{mensaje.contenido}</p>
              </li>
            ))}
          </ol>
          {!datos.mensajes.length && (
            <p className="text-sm text-muted-foreground">
              Aún no hay mensajes. Puedes iniciar la conversación con una consulta o un hallazgo.
            </p>
          )}
          <form onSubmit={enviar} className="space-y-2">
            <label htmlFor={`mensaje-${siniestroId}`} className="text-sm font-medium">
              Mensaje para {rol === 'TALLER' ? 'el perito' : 'el taller'}
            </label>
            <textarea
              id={`mensaje-${siniestroId}`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={2000}
              required
              disabled={enviando}
              rows={3}
              placeholder="Describe lo que encontraste o lo que necesitas revisar…"
              className="block w-full rounded-xl border p-3 text-sm"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{texto.length}/2000</span>
              <button
                disabled={!texto.trim() || enviando}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {enviando ? 'Enviando…' : 'Enviar mensaje'}
              </button>
            </div>
          </form>
        </>
      )}
      {aviso && (
        <p role="status" className="text-sm text-emerald-800">
          {aviso}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
