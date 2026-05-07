import { useEffect } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true, duration: 0.25 });
  }, [lat, lng, map]);
  return null;
}

function MapClickHandler({ onPick }: { onPick: (la: number, lo: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

type WorkSiteMapProps = {
  lat: number;
  lng: number;
  radiusM: number;
  onPositionChange: (lat: number, lng: number) => void;
  /** OpenStreetMap tiles — requires network on first paint */
  mapClickHint?: string;
  /** When false, map is view-only (cards). */
  interactive?: boolean;
};

export function WorkSiteMap({
  lat,
  lng,
  radiusM,
  onPositionChange,
  mapClickHint,
  interactive = true,
}: WorkSiteMapProps) {
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const cLat = valid ? lat : 5.3364;
  const cLng = valid ? lng : -4.0277;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-outline/20 ring-1 ring-primary/5">
      {interactive && mapClickHint && (
        <p className="absolute right-2 top-2 z-[500] max-w-[min(100%,18rem)] rounded-lg bg-surface/95 px-2 py-1.5 text-xs text-on-surface shadow-md ring-1 ring-outline/20">
          {mapClickHint}
        </p>
      )}
      <div
        className={`w-full [&_.leaflet-control-attribution]:text-[10px] ${
          interactive ? 'h-[min(55vh,420px)] min-h-[240px]' : 'h-36 min-h-[9rem]'
        }`}
      >
        <MapContainer
          center={[cLat, cLng]}
          zoom={interactive ? 14 : 15}
          scrollWheelZoom={interactive}
          dragging={interactive}
          doubleClickZoom={interactive}
          boxZoom={interactive}
          keyboard={interactive}
          zoomControl={interactive}
          className="h-full w-full rounded-2xl"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recenter lat={cLat} lng={cLng} />
          <Circle
            center={[cLat, cLng]}
            radius={radiusM}
            pathOptions={{
              color: '#006838',
              fillColor: '#006838',
              fillOpacity: 0.12,
              weight: 2,
            }}
          />
          <Marker
            position={[cLat, cLng]}
            draggable={interactive}
            eventHandlers={
              interactive
                ? {
                    dragend(e) {
                      const p = e.target.getLatLng();
                      onPositionChange(p.lat, p.lng);
                    },
                  }
                : {}
            }
          />
          {interactive && <MapClickHandler onPick={onPositionChange} />}
        </MapContainer>
      </div>
    </div>
  );
}
