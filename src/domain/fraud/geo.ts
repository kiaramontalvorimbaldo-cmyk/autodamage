import { GPS_DISTANCIA_MAX_M } from '@/domain/config';

export type PuntoGps = {
  latitud: number;
  longitud: number;
};

const TIERRA_RADIO_M = 6_371_000;

const radianes = (grados: number): number => (grados * Math.PI) / 180;

/**
 * Distancia en metros entre dos puntos GPS (fórmula de Haversine).
 */
export function haversineMeters(a: PuntoGps, b: PuntoGps): number {
  const dLat = radianes(b.latitud - a.latitud);
  const dLon = radianes(b.longitud - a.longitud);
  const lat1 = radianes(a.latitud);
  const lat2 = radianes(b.latitud);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * TIERRA_RADIO_M * Math.asin(Math.sqrt(h));
}

/**
 * Inconsistencia GPS: la distancia entre el GPS de la imagen y la
 * ubicación declarada del siniestro supera max(GPS_DISTANCIA_MAX_M, precision_gps_m).
 */
export function excedeUmbralGps(
  imagen: PuntoGps,
  siniestro: PuntoGps,
  precisionGpsM: number | null,
): boolean {
  const umbral = Math.max(GPS_DISTANCIA_MAX_M, precisionGpsM ?? 0);
  return haversineMeters(imagen, siniestro) > umbral;
}
