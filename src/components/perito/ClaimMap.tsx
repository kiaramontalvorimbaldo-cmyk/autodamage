'use client';

import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type PuntoMapa = {
  latitud: number;
  longitud: number;
  etiqueta?: string;
};

function SeleccionarPunto({ onSelect }: { onSelect: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (evento) => onSelect(evento.latlng.lat, evento.latlng.lng) });
  return null;
}

/**
 * Mapa con la ubicación declarada del siniestro y las
 * ubicaciones de las fotos (OpenStreetMap + Leaflet).
 * Se carga solo en el cliente (sin SSR) desde el componente padre.
 */
export function ClaimMap({
  centro,
  puntos = [],
  onSelect,
}: {
  centro: [number, number];
  puntos?: PuntoMapa[];
  onSelect?: (lat: number, lon: number) => void;
}) {
  const icono = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  return (
    <div
      style={{ height: 320 }}
      className="overflow-hidden rounded-lg border border-gray-200"
      data-testid="claim-map"
    >
      <MapContainer
        center={centro}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        {onSelect && <SeleccionarPunto onSelect={onSelect} />}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={centro} icon={icono}>
          <Popup>Ubicación declarada del siniestro</Popup>
        </Marker>
        {puntos.map((punto, indice) => (
          <Marker key={`foto-${indice}`} position={[punto.latitud, punto.longitud]} icon={icono}>
            <Popup>{punto.etiqueta ?? `Foto ${indice + 1}`}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
