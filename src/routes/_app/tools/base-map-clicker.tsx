import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MapContainer, Marker, TileLayer, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { DayZPageHeader } from "@/components/dayz/DayZPageHeader";
import { Button } from "@/components/ui/button";
import { IconCampaign } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { DAYZ_SERVERS, type DayZServerId } from "@/lib/dayz/servers";
import { fireMapStrike, runRadarScan, publishMapHeatmap, type MapId, type StrikeKind, type RadarMode } from "@/lib/map-ops.functions";
import { useAuth } from "@/contexts/AuthContext";
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

type ToolMode = "coords" | StrikeKind | RadarMode | "heatmap";

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
const { user } = useAuth();
const playerId = user?.id || "demo-user";
const displayName =
(typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
user?.email ||
playerId;

const [mapId, setMapId] = useState<MapId>("chernarus");
const [serverId, setServerId] = useState<DayZServerId>("101x");
const [tool, setTool] = useState<ToolMode>("coords");
const [picked, setPicked] = useState<L.LatLng | null>(null);
const [radius, setRadius] = useState(250);
const [note, setNote] = useState("");
const [heatPoints, setHeatPoints] = useState<{ x: number; z: number; weight: number }[]>([])

const map = MAPS[mapId];
const world = useMemo(() => (picked ? latLngToWorld(picked, map.worldSize) : null), [picked, map.worldSize]);

const strikeMut = useMutation({
mutationFn: () => {
if (!world) throw new Error("Pick a map point first");
if (tool !== "airstrike" && tool !== "gas" && tool !== "strafe") throw new Error("Pick a strike tool");
return fireMapStrike({
data: {
kind: tool,
x: world.x,
z: world.z,
radius,
map: mapId,
serverId,
playerId,
displayName,
note: note.trim() || undefined,
},
});
},
onSuccess: () => toast.success(`${tool} queued`, { description: `X ${world?.x} · Z ${world?.z}` }),
onError: (err) => toast.error(err instanceof Error ? err.message : "Strike failed"),
});

const radarMut = useMutation({
mutationFn: () => {
if (!world) throw new Error("Pick a map point first");
if (tool !== "base" && tool !== "counter_uav") throw new Error("Pick a radar tool");
return runRadarScan({
data: {
mode: tool,
x: world.x,
z: world.z,
radius,
map: mapId,
serverId,
playerId,
displayName,
},
});
},
onSuccess: (res) =>
toast.success(`${tool === "base" ? "Base radar" : "Counter-UAV"} scan`, {
description: `r${res.radius} · ${res.durationSec}s`,
}),
onError: (err) => toast.error(err instanceof Error ? err.message : "Radar failed"),
});

const heatMut = useMutation({
mutationFn: () => {
if (heatPoints.length === 0) throw new Error("Click the map to add heatmap points");
return publishMapHeatmap({
data: {
map: mapId,
points: heatPoints,
serverId,
playerId,
displayName,
},
});
},
onSuccess: (res) => {
toast.success(`Heatmap published · ${res.count} points`);
setHeatPoints([]);
},
onError: (err) => toast.error(err instanceof Error ? err.message : "Heatmap failed"),
});

const tools: { id: ToolMode; label: string }[] = [
{ id: "coords", label: "Coords" },
{ id: "airstrike", label: "Airstrike" },
{ id: "gas", label: "Gas" },
{ id: "strafe", label: "Strafe" },
{ id: "base", label: "Base radar" },
{ id: "counter_uav", label: "Counter-UAV" },
{ id: "heatmap", label: "Heatmap" },
];

return (
<div className="mx-auto max-w-6xl px-4 py-8 space-y-4">
<DayZPageHeader
title="DayZ Map"
subtitle="Coordinates, strikes, and radar scans mirrored to Discord"
icon={<IconCampaign size={16} />}
hue={25}
actions={
<div className="flex flex-wrap gap-2">
{(Object.keys(MAPS) as MapId[]).map((id) => (
<Button key={id} size="sm" variant={mapId === id ? "default" : "outline"} onClick={() => { setMapId(id); setPicked(null); setHeatPoints([]); }}>
{MAPS[id].label}
</Button>
))}
</div>
}
/>

<div className="flex flex-wrap gap-2">
{DAYZ_SERVERS.map((s) => (
<Button key={s.id} size="sm" variant={serverId === s.id ? "default" : "outline"} onClick={() => setServerId(s.id)}>
{s.id}
</Button>
))}
{tools.map((t) => (
<Button key={t.id} size="sm" variant={tool === t.id ? "default" : "outline"} onClick={() => setTool(t.id)}>
{t.label}
</Button>
))}
</div>

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
<ClickCapture
onPick={(ll) => {
setPicked(ll);
if (tool === "heatmap") {
const w = latLngToWorld(ll, map.worldSize);
setHeatPoints((prev) => [...prev, { x: w.x, z: w.z, weight: 1 }].slice(-200));
}
}}
/>
{picked && <Marker position={picked} icon={markerIcon} />}
{picked && tool !== "coords" && (
<Circle
center={picked}
radius={(radius / map.worldSize) * TILE_SIZE}
pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.15 }}
/>
)}
</MapContainer>
</div>
</GlassPanel>

<GlassPanel className="p-4 text-sm space-y-3">
{world ? (
<>
<div className="flex flex-wrap items-center justify-between gap-3">
<div>
<div className="text-xs uppercase tracking-wider text-muted-foreground">{map.label} · {serverId}</div>
<div className="font-mono text-lg text-primary">X {world.x} · Z {world.z}</div>
</div>
<Button size="sm" onClick={() => navigator.clipboard.writeText(`${world.x} ${world.z}`)}>
Copy coords
</Button>
</div>
{tool !== "coords" && (
<div className="flex flex-wrap items-end gap-3">
<label className="text-xs text-muted-foreground">
Radius
<input
type="number"
min={50}
max={2000}
value={radius}
onChange={(e) => setRadius(Number(e.target.value) || 250)}
className="mt-1 block w-28 rounded-md border border-glass-border bg-black/40 px-2 py-1.5 font-mono text-sm"
/>
</label>
{(tool === "airstrike" || tool === "gas" || tool === "strafe") && (
<label className="text-xs text-muted-foreground flex-1 min-w-[180px]">
Note
<input
value={note}
onChange={(e) => setNote(e.target.value)}
className="mt-1 block w-full rounded-md border border-glass-border bg-black/40 px-2 py-1.5 text-sm"
placeholder="optional"
/>
</label>
)}
{(tool === "airstrike" || tool === "gas" || tool === "strafe") && (
<Button
disabled={strikeMut.isPending}
onClick={() => strikeMut.mutate()}
>
{strikeMut.isPending ? "Sending…" : `Fire ${tool}`}
</Button>
)}
{(tool === "base" || tool === "counter_uav") && (
<Button
disabled={radarMut.isPending}
onClick={() => radarMut.mutate()}
>
{radarMut.isPending ? "Scanning…" : tool === "base" ? "Run base radar" : "Run counter-UAV"}
</Button>
)}
{tool === "heatmap" && (
<div className="flex flex-wrap items-center gap-2">
<span className="text-xs text-muted-foreground">{heatPoints.length} points</span>
<Button size="sm" variant="outline" onClick={() => setHeatPoints([])} disabled={heatPoints.length === 0}>
Clear
</Button>
<Button disabled={heatMut.isPending || heatPoints.length === 0} onClick={() => heatMut.mutate()}>
{heatMut.isPending ? "Publishing…" : "Publish heatmap"}
</Button>
</div>
)}
</div>
)}
</>
) : (
<p className="text-muted-foreground">Click the map to drop a pin, then fire a strike or radar scan.</p>
)}
</GlassPanel>
</div>
);
}
