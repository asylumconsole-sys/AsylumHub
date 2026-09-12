import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { DayZPageHeader } from "@/components/dayz/DayZPageHeader";
import { Button } from "@/components/ui/button";
import { IconCampaign } from "@/components/ui-custom/CustomIcon";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/_app/tools/base-map-clicker")({
  component: BaseMapClickerPage,
});

const TILE_SIZE = 256;
const MAP_CENTER: [number, number] = [-TILE_SIZE / 2, TILE_SIZE / 2];

const markerIcon = L.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;border-radius:9999px;background:#f59e0b;border:2px solid white;box-shadow:0 0 10px #f59e0b"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const MAPS = {
  chernarus: {
    label: "Chernarus",
    worldSize: 15360,
    tileUrl: "https://static.xam.nu/dayz/maps/chernarusplus/1.27/satellite/{z}/{x}/{y}.webp",
    zoom: 2,
  },
  livonia: {
    label: "Livonia",
    worldSize: 12800,
    tileUrl: "https://static.xam.nu/dayz/maps/livonia/1.27/satellite/{z}/{x}/{y}.webp",
    zoom: 2,
  },
} as const;

type MapId = keyof typeof MAPS;

function ClickCapture({ onPick }: { onPick: (point: L.LatLng) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng);
    },
  });
  return null;
}

function latLngToWorld(latlng: L.LatLng, worldSize: number) {
  const x = (latlng.lng / TILE_SIZE) * worldSize;
  const z = ((-latlng.lat) / TILE_SIZE) * worldSize;
  return { x: Math.round(x), z: Math.round(z) };
}

function BaseMapClickerPage() {
  const [mapId, setMapId] = useState<MapId>("chernarus");
  const [picked, setPicked] = useState<L.LatLng | null>(null);
  const map = MAPS[mapId];
  const world = useMemo(() => (picked ? latLngToWorld(picked, map.worldSize) : null), [picked, map.worldSize]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-4">
      <DayZPageHeader
        title="DayZ Map"
        subtitle="Click the satellite map to copy in-game coordinates"
        icon={<IconCampaign size={16} />}
        hue={25}
        actions={
          <div className="flex gap-2">
            {(Object.keys(MAPS) as MapId[]).map((id) => (
              <Button key={id} size="sm" variant={mapId === id ? "default" : "outline"} onClick={() => { setMapId(id); setPicked(null); }}>
                {MAPS[id].label}
              </Button>
            ))}
          </div>
        }
      />
      <GlassPanel className="overflow-hidden p-0">
        <div className="h-[70vh] min-h-[480px]">
          <MapContainer
            key={mapId}
            center={MAP_CENTER}
            zoom={map.zoom}
            minZoom={1}
            maxZoom={6}
            crs={L.CRS.Simple}
            className="h-full w-full bg-black"
          >
            <TileLayer url={map.tileUrl} tileSize={TILE_SIZE} noWrap />
            <ClickCapture onPick={setPicked} />
            {picked && <Marker position={picked} icon={markerIcon} />}
          </MapContainer>
        </div>
      </GlassPanel>
      <GlassPanel className="p-4 text-sm">
        {world ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{map.label} coordinates</div>
              <div className="font-mono text-lg text-primary">X {world.x} \u00b7 Z {world.z}</div>
            </div>
            <Button
              size="sm"
              onClick={() => navigator.clipboard.writeText(`${world.x} ${world.z}`)}
            >
              Copy coords
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">Click the map to drop a pin and read DayZ world coordinates.</p>
        )}
      </GlassPanel>
    </div>
  );
}
