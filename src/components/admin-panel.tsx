'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { mensajeDeError } from '@/lib/user-messages';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';

type Datos = {
  usuarios: { id: string; nombre_completo: string; email: string; rol: string }[];
  peritos: { usuario_id: string; estado: string }[];
  talleres: { id: string; usuario_id: string; nombre: string; activo: boolean }[];
  casos: {
    id: string;
    estado: string;
    ruta: string | null;
    fecha_incidente: string;
    descripcion: string;
  }[];
  ordenes: { siniestro_id: string; taller_id: string; estado: string }[];
  registros: {
    id: string;
    entidad_id: string;
    accion: string;
    actor_tipo: string;
    creado_en: string;
    datos: unknown;
  }[];
};

export function AdminPanel({ vista }: { vista: 'casos' | 'personal' | 'auditoria' }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [temporal, setTemporal] = useState<string | null>(null);
  const [tipo, setTipo] = useState('PERITO');
  async function cargar() {
    setError(null);
    try {
      setDatos(await apiFetch<Datos>('/api/admin/resumen'));
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }
  useEffect(() => {
    void cargar();
  }, []);
  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    setOcupado(true);
    setError(null);
    setTemporal(null);
    try {
      const r = await apiFetch<{ passwordTemporal: string }>('/api/admin/personal', {
        method: 'POST',
        body,
      });
      setTemporal(r.passwordTemporal);
      form.reset();
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }
  async function activar(id: string, activo: boolean) {
    setOcupado(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/personal/${id}`, { method: 'PATCH', body: { activo } });
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }
  const coincide = (texto: string) =>
    texto.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase());
  return (
    <section className="space-y-5">
      <Link href="/admin" className="text-primary underline">
        ← Administración
      </Link>
      <h1 className="text-2xl font-semibold">
        {vista === 'casos' ? 'Casos' : vista === 'personal' ? 'Personal' : 'Auditoría'}
      </h1>
      <p className="text-sm text-muted-foreground">
        {vista === 'auditoria'
          ? 'Últimos 100 eventos, de solo lectura.'
          : vista === 'casos'
            ? 'Últimos 100 casos y su taller asignado.'
            : 'Equipo de peritos y talleres (hasta 200 registros).'}
      </p>
      {error && <ErrorState mensaje={error} alReintentar={() => void cargar()} />}
      {!datos ? (
        !error && <LoadingState />
      ) : (
        <>
          <label className="block text-sm">
            Buscar
            <input
              className="mt-1 block w-full rounded-lg border bg-white p-3"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
          {vista === 'casos' && (
            <div className="space-y-3">
              {datos.casos
                .filter((c) => coincide(`${c.id} ${c.estado} ${c.descripcion}`))
                .map((c) => {
                  const orden = datos.ordenes.find((o) => o.siniestro_id === c.id);
                  const taller = datos.talleres.find((t) => t.id === orden?.taller_id);
                  return (
                    <article key={c.id} className="rounded-xl border bg-white p-5">
                      <h2 className="font-semibold">Siniestro {c.id.slice(0, 8)}</h2>
                      <p className="text-sm">
                        {c.estado} · {c.ruta ?? 'Sin ruta'}
                      </p>
                      <p className="mt-2 text-sm">{c.descripcion}</p>
                      <p className="mt-2 text-sm">
                        {orden
                          ? `Taller: ${taller?.nombre ?? 'No disponible'} · Orden ${orden.estado}`
                          : 'Sin orden de trabajo'}
                      </p>
                      <Link
                        className="text-sm text-primary underline"
                        href={`/admin/casos/${c.id}`}
                      >
                        Ver evidencias y análisis
                      </Link>
                    </article>
                  );
                })}
              {datos.casos.length === 0 && <p>No hay casos registrados.</p>}
            </div>
          )}
          {vista === 'auditoria' && (
            <ol className="space-y-3">
              {datos.registros
                .filter((r) => coincide(`${r.accion} ${r.entidad_id} ${r.actor_tipo}`))
                .map((r) => (
                  <li key={r.id} className="rounded-xl border bg-white p-4">
                    <strong>{r.accion}</strong>
                    <p className="text-sm">
                      {r.actor_tipo} · {new Date(r.creado_en).toLocaleString('es-BO')} ·{' '}
                      {r.entidad_id}
                    </p>
                    <details className="mt-2 text-sm">
                      <summary>Datos de la decisión</summary>
                      <pre className="overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(r.datos, null, 2)}
                      </pre>
                    </details>
                  </li>
                ))}
              {datos.registros.length === 0 && <p>No hay eventos registrados.</p>}
            </ol>
          )}
          {vista === 'personal' && (
            <>
              <div className="space-y-3">
                {datos.usuarios
                  .filter(
                    (u) =>
                      ['PERITO', 'TALLER'].includes(u.rol) &&
                      coincide(`${u.nombre_completo} ${u.email}`),
                  )
                  .map((u) => {
                    const perito = datos.peritos.find((p) => p.usuario_id === u.id),
                      taller = datos.talleres.find((t) => t.usuario_id === u.id);
                    const activo =
                      u.rol === 'PERITO'
                        ? Boolean(perito && perito.estado !== 'INACTIVO')
                        : Boolean(taller?.activo);
                    return (
                      <article
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"
                        key={u.id}
                      >
                        <div>
                          <h2 className="font-semibold">{u.nombre_completo}</h2>
                          <p className="text-sm">
                            {u.email} · {u.rol} · {activo ? 'Activo' : 'Inactivo'}
                            {taller && ` · ${taller.nombre}`}
                          </p>
                        </div>
                        <button
                          disabled={ocupado}
                          className="rounded-lg border px-3 py-2 text-sm"
                          onClick={() => void activar(u.id, !activo)}
                        >
                          {activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </article>
                    );
                  })}
              </div>
              <form onSubmit={crear} className="space-y-3 rounded-2xl border bg-white p-5">
                <h2 className="font-semibold">Registrar personal</h2>
                <label className="block text-sm">
                  Tipo
                  <select
                    name="tipo"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    className="ml-2 rounded border p-2"
                  >
                    <option value="PERITO">Perito</option>
                    <option value="TALLER">Taller</option>
                  </select>
                </label>
                {[
                  ['nombre', 'Nombre completo'],
                  ['email', 'Correo electrónico'],
                  [
                    tipo === 'PERITO' ? 'numero_licencia' : 'nombre_taller',
                    tipo === 'PERITO' ? 'Número de licencia' : 'Nombre del taller',
                  ],
                ].map(([name, label]) => (
                  <label className="block text-sm" key={name}>
                    {label}
                    <input
                      name={name}
                      type={name === 'email' ? 'email' : 'text'}
                      required
                      minLength={name === 'numero_licencia' ? 3 : 2}
                      maxLength={150}
                      className="mt-1 block w-full rounded-lg border p-2"
                    />
                  </label>
                ))}
                <button disabled={ocupado} className="rounded-lg bg-primary px-4 py-2 text-white">
                  {ocupado ? 'Guardando…' : 'Crear cuenta'}
                </button>
              </form>
              {temporal && (
                <div role="status" className="rounded-xl border bg-amber-50 p-4">
                  Cuenta creada. Contraseña temporal (se muestra solo ahora):{' '}
                  <code>{temporal}</code>
                  <button className="ml-3 underline" onClick={() => setTemporal(null)}>
                    Ocultar
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
