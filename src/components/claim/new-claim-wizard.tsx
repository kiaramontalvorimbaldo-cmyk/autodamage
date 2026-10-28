'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Check } from 'lucide-react';
import { CameraCapture } from '@/components/camera/CameraCapture';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { VehicleDialog } from '@/components/vehicle/vehicle-dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui-extra/empty-state';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useGeolocation, MENSAJES_GPS } from '@/hooks/useGeolocation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { mensajeDeError } from '@/lib/user-messages';
import type { Vehiculo } from '@/domain/entities';

const ClaimMap = dynamic(
  () =>
    import('@/components/perito/ClaimMap').then((mod) => ({
      default: mod.ClaimMap,
    })),
  { ssr: false },
);

type FotoCapturada = {
  id: string;
  blob: Blob;
  capturadaEn: string;
  latitud: number | null;
  longitud: number | null;
  precisionGpsM: number | null;
  urlPreview: string;
};

const MIN_FOTOS = 3;
const MAX_FOTOS = 5;

const PASOS = [
  { numero: 1, nombre: 'Vehículo' },
  { numero: 2, nombre: 'Detalles' },
  { numero: 3, nombre: 'Fotos' },
  { numero: 4, nombre: 'Revisar' },
] as const;

/** Texto de ayuda que explica por qué el botón "Siguiente" está deshabilitado. */
function coordenadasValidas(latitud: string, longitud: string): boolean {
  if (!latitud || !longitud) return false;

  const lat = Number(latitud);
  const lon = Number(longitud);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function ayudaDeSiguiente(
  paso: number,
  vehiculoId: string,
  fotos: number,
  fechaIncidente: string,
  latitud: string,
  longitud: string,
): string | null {
  if (paso === 1 && !vehiculoId) return 'Selecciona un vehículo para continuar';
  if (paso === 2) {
    if (!fechaIncidente) return 'Completa la fecha del incidente para continuar';
    if (!coordenadasValidas(latitud, longitud)) {
      return 'Indica una latitud y longitud válidas para continuar';
    }
    return null;
  }
  if (paso === 3 && fotos < MIN_FOTOS) return `Captura al menos ${MIN_FOTOS} fotos para continuar`;
  return null;
}

/**
 * Asistente de reporte de siniestro en 4 pasos.
 * Envuelve la lógica existente de captura y envío: solo añade navegación,
 * ayuda visible y posibilidad de salir sin perder el borrador.
 */
export function NewClaimWizard() {
  const router = useRouter();
  const solicitudId = useRef<string | null>(null);
  const [siniestroCreadoId, setSiniestroCreadoId] = useState<string | null>(null);
  const [paso, setPaso] = useState(1);
  const [vehiculos, setVehiculos] = useState<Vehiculo[] | null>(null);
  const [vehiculoId, setVehiculoId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaIncidente, setFechaIncidente] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [fotos, setFotos] = useState<FotoCapturada[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);
  const { solicitar, posicion, error: errorGeo, cargando: cargandoGeo } = useGeolocation();

  useEffect(() => {
    apiFetch<Vehiculo[]>('/api/vehiculos')
      .then(setVehiculos)
      .catch(() => setError('No se pudieron cargar tus vehículos'));
  }, []);

  useEffect(() => {
    if (posicion) {
      setLatitud(String(posicion.latitud));
      setLongitud(String(posicion.longitud));
    }
  }, [posicion]);

  const ayuda = ayudaDeSiguiente(paso, vehiculoId, fotos.length, fechaIncidente, latitud, longitud);
  const hayDatos = Boolean(
    vehiculoId || descripcion || fechaIncidente || fotos.length > 0 || latitud || longitud,
  );
  const coordenadasSonValidas = coordenadasValidas(latitud, longitud);
  const latNumero = Number(latitud);
  const lonNumero = Number(longitud);

  function registrarVehiculo(vehiculo: Vehiculo) {
    setVehiculos((actuales) => [...(actuales ?? []), vehiculo]);
    setVehiculoId(vehiculo.id);
    setError(null);
  }

  async function usarGeolocalizacion() {
    const pos = await solicitar();
    if (pos) setError(null);
  }

  function agregarFoto(resultado: { blob: Blob; capturadaEn: string }) {
    if (fotos.length >= MAX_FOTOS) return;
    setFotos((actuales) => [
      ...actuales,
      {
        id: crypto.randomUUID(),
        blob: resultado.blob,
        capturadaEn: resultado.capturadaEn,
        latitud: posicion?.latitud ?? (latitud ? Number(latitud) : null),
        longitud: posicion?.longitud ?? (longitud ? Number(longitud) : null),
        precisionGpsM: posicion?.precisionM ?? null,
        urlPreview: URL.createObjectURL(resultado.blob),
      },
    ]);
  }

  function quitarFoto(indice: number) {
    setFotos((actuales) => actuales.filter((_, i) => i !== indice));
  }

  function cancelar() {
    if (!hayDatos) {
      router.push('/asegurado/siniestros');
      return;
    }
    setConfirmandoCancelacion(true);
  }

  async function enviar() {
    setError(null);
    if (!vehiculoId) return setError('Selecciona un vehículo');
    if (!fechaIncidente) return setError('Indica la fecha del incidente');
    const lat = Number(latitud);
    const lon = Number(longitud);
    if (!latitud || !longitud || Number.isNaN(lat) || Number.isNaN(lon)) {
      return setError('Indica la ubicación del incidente');
    }
    if (fotos.length < MIN_FOTOS) {
      return setError(`Captura al menos ${MIN_FOTOS} fotos`);
    }

    solicitudId.current ??= crypto.randomUUID();
    setEnviando(true);
    try {
      const siniestro = await apiFetch<{ id: string }>('/api/siniestros', {
        method: 'POST',
        body: {
          solicitud_id: solicitudId.current,
          vehiculo_id: vehiculoId,
          descripcion: descripcion || null,
          fecha_incidente: new Date(fechaIncidente).toISOString(),
          latitud: lat,
          longitud: lon,
        },
      });

      setSiniestroCreadoId(siniestro.id);
      const actual = await apiFetch<{ siniestro: { analisisEstado: string } }>(
        `/api/siniestros/${siniestro.id}`,
      );
      if (actual.siniestro.analisisEstado !== 'NO_INICIADO') {
        router.push(`/asegurado/siniestros/${siniestro.id}`);
        return;
      }
      for (const [indice, foto] of fotos.entries()) {
        const form = new FormData();
        form.append('imagen_id', foto.id);
        form.append('file', foto.blob, `evidencia-${indice}.jpg`);
        form.append('capturada_en', foto.capturadaEn);
        if (foto.latitud !== null) form.append('latitud', String(foto.latitud));
        if (foto.longitud !== null) form.append('longitud', String(foto.longitud));
        if (foto.precisionGpsM !== null) form.append('precision_gps_m', String(foto.precisionGpsM));
        form.append('orden', String(indice));
        form.append('rostros_difuminados', 'true');
        await apiFetch(`/api/siniestros/${siniestro.id}/imagenes`, {
          method: 'POST',
          body: form,
        });
      }

      await apiFetch(`/api/siniestros/${siniestro.id}/analizar`, {
        method: 'POST',
      });
      router.push(`/asegurado/siniestros/${siniestro.id}`);
    } catch (e) {
      setError(
        e instanceof ApiError || e instanceof Error
          ? mensajeDeError(e)
          : 'No se pudo registrar el siniestro',
      );
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Stepper visual */}
      <ol className="flex items-center justify-between gap-1" aria-label="Pasos del reporte">
        {PASOS.map((item, indice) => {
          const completado = item.numero < paso;
          const actual = item.numero === paso;
          return (
            <li key={item.numero} className="flex flex-1 items-center gap-1">
              <span
                aria-current={actual ? 'step' : undefined}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium sm:text-sm ${
                  actual
                    ? 'bg-primary text-primary-foreground'
                    : completado
                      ? 'text-primary'
                      : 'text-muted-foreground'
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border text-xs">
                  {completado ? <Check aria-hidden="true" className="h-3 w-3" /> : item.numero}
                </span>
                <span>{item.nombre}</span>
                {completado && <span className="sr-only">completado</span>}
              </span>
              {indice < PASOS.length - 1 && (
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              )}
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-muted-foreground">
        Paso {paso} de {PASOS.length}: {PASOS[paso - 1].nombre}
      </p>

      {error && <ErrorState mensaje={error} alReintentar={paso === 4 ? enviar : undefined} />}
      {error && siniestroCreadoId && (
        <p className="rounded-xl border bg-amber-50 p-3 text-sm">
          El reporte ya fue creado.{' '}
          <Link
            className="text-primary underline"
            href={`/asegurado/siniestros/${siniestroCreadoId}`}
          >
            Continuar la carga en ese mismo reporte
          </Link>
          .
        </p>
      )}

      {paso === 1 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium">1. Vehículo del siniestro</h2>
          {vehiculos === null ? (
            <LoadingState mensaje="Cargando tus vehículos…" />
          ) : vehiculos.length === 0 ? (
            <EmptyState
              titulo="Aún no tienes vehículos"
              descripcion="Registra tu vehículo para poder reportar un siniestro."
              accion={
                <Button onClick={() => setDialogoAbierto(true)}>
                  Registrar mi primer vehículo
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {vehiculos.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setVehiculoId(v.id)}
                    aria-pressed={vehiculoId === v.id}
                    className={`w-full rounded-md border p-3 text-left text-sm ${
                      vehiculoId === v.id ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    {v.marca} {v.modelo} — {v.matricula}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button variant="outline" onClick={() => setDialogoAbierto(true)}>
            Registrar otro vehículo
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={cancelar}>
              Cancelar
            </Button>
            <Button disabled={Boolean(ayuda)} onClick={() => setPaso(2)}>
              Siguiente
            </Button>
          </div>
          {ayuda && <p className="text-sm text-muted-foreground">{ayuda}</p>}
        </section>
      )}

      {paso === 2 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium">2. Datos del incidente</h2>
          <label className="block">
            <span className="text-sm font-medium">Descripción</span>
            <textarea
              value={descripcion}
              maxLength={2000}
              onChange={(e) => setDescripcion(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2"
              rows={3}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Fecha y hora del incidente</span>
            <input
              type="datetime-local"
              value={fechaIncidente}
              onChange={(e) => setFechaIncidente(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </label>
          <Button variant="outline" disabled={cargandoGeo} onClick={usarGeolocalizacion}>
            {cargandoGeo ? 'Buscando ubicación…' : 'Usar mi ubicación actual'}
          </Button>
          {errorGeo && (
            <p role="status" className="text-sm text-muted-foreground">
              {MENSAJES_GPS[errorGeo]}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm">Latitud</span>
              <input
                type="number"
                step="any"
                value={latitud}
                onChange={(e) => setLatitud(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm">Longitud</span>
              <input
                type="number"
                step="any"
                value={longitud}
                onChange={(e) => setLongitud(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </label>
          </div>
          <p className="text-sm text-muted-foreground">
            También puedes tocar el mapa para indicar el lugar del incidente. Esa selección es
            manual, no una lectura GPS.
          </p>
          <ClaimMap
            key={`${latNumero}-${lonNumero}`}
            centro={coordenadasSonValidas ? [latNumero, lonNumero] : [-16.5, -68.15]}
            onSelect={(lat, lon) => {
              setLatitud(String(lat));
              setLongitud(String(lon));
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPaso(1)}>
              Atrás
            </Button>
            <Button variant="outline" onClick={cancelar}>
              Cancelar
            </Button>
            <Button disabled={Boolean(ayuda)} onClick={() => setPaso(3)}>
              Siguiente
            </Button>
          </div>
          {ayuda && <p className="text-sm text-muted-foreground">{ayuda}</p>}
        </section>
      )}

      {paso === 3 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium">
            3. Fotos en vivo ({fotos.length}/{MAX_FOTOS})
          </h2>
          <CameraCapture onCaptura={agregarFoto} deshabilitado={fotos.length >= MAX_FOTOS} />
          <ul className="grid grid-cols-3 gap-2">
            {fotos.map((foto, indice) => (
              <li key={indice} className="relative">
                <img
                  src={foto.urlPreview}
                  alt={`Captura ${indice + 1}`}
                  className="h-24 w-full rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={() => quitarFoto(indice)}
                  aria-label={`Repetir captura ${indice + 1}`}
                  className="absolute right-1 top-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPaso(2)}>
              Atrás
            </Button>
            <Button variant="outline" onClick={cancelar}>
              Cancelar
            </Button>
            <Button disabled={Boolean(ayuda)} onClick={() => setPaso(4)}>
              Siguiente
            </Button>
          </div>
          {ayuda && <p className="text-sm text-muted-foreground">{ayuda}</p>}
        </section>
      )}

      {paso === 4 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium">4. Revisión y envío</h2>
          <dl className="space-y-1 text-sm text-muted-foreground">
            <div>
              <dt className="inline font-medium text-foreground">Vehículo: </dt>
              <dd className="inline">
                {vehiculos?.find((v) => v.id === vehiculoId)?.matricula ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">Fotos: </dt>
              <dd className="inline">{fotos.length}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">Fecha: </dt>
              <dd className="inline">{fechaIncidente || '—'}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPaso(3)}>
              Atrás
            </Button>
            <Button variant="outline" onClick={cancelar}>
              Cancelar
            </Button>
            <Button variant="default" onClick={enviar} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar siniestro'}
            </Button>
          </div>
        </section>
      )}

      <VehicleDialog
        abierto={dialogoAbierto}
        alCambiarAbierto={setDialogoAbierto}
        alGuardar={registrarVehiculo}
      />

      <Dialog
        open={confirmandoCancelacion}
        onOpenChange={(abierto) => setConfirmandoCancelacion(abierto)}
      >
        <DialogContent titulo="¿Salir del reporte?">
          <p className="text-sm">
            Perderás los datos que ya escribiste y las fotos capturadas. ¿Quieres salir de todas
            formas?
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setConfirmandoCancelacion(false)}>
              Seguir editando
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmandoCancelacion(false);
                router.push('/asegurado/siniestros');
              }}
            >
              Sí, salir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { MIN_FOTOS, MAX_FOTOS };
