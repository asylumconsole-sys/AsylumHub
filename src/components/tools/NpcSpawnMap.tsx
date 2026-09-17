import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DAYZ_MAP_BOUNDS_LATLNG, DAYZ_MAP_CENTER, DAYZ_MAPS, mapIdForServer } from "@/lib/dayz/map-tiles";

const bounds = L.latLngBounds(DAYZ_MAP_BOUNDS_LATLNG);

const markerIcon = L.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;border-radius:9999px;background:#ef4444;border:2px solid white;box-shadow:0 0 8px #ef4444"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Client-only Leaflet map — must be lazy-loaded, leaflet touches `window` on import and crashes SSR. */
export default function NpcSpawnMap({
  serverId,
  pos,
  onPick,
}: {
  serverId: string;
  pos: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const mapId = mapIdForServer(serverId);
  const dayzMap = DAYZ_MAPS[mapId];

  return (
    <MapContainer
      key={mapId}
      crs={L.CRS.Simple}
      center={DAYZ_MAP_CENTER}
      zoom={2}
      minZoom={0}
      maxZoom={9}
      maxBounds={bounds}
      maxBoundsViscosity={1}
      className="h-full w-full bg-[#11150f]"
      scrollWheelZoom
    >
      <TileLayer
        attribution="DayZ map imagery &copy; XAM"
        url={dayzMap.tileUrl}
        bounds={bounds}
        minZoom={0}
        maxNativeZoom={7}
        maxZoom={9}
        noWrap
      />
      <ClickCapture onPick={onPick} />
      {pos && <Marker position={[pos.lat, pos.lng]} icon={markerIcon} />}
    </MapContainer>
  );
}
