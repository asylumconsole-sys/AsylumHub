import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { toast } from "sonner";
import { getOnlinePlayers, type OnlinePlayer } from "@/lib/online-players.functions";
import { getLeaderboards, type PlayerStats } from "@/lib/stats.functions";
import "leaflet/dist/leaflet.css";

const TILE = 256;
const MAPS = {
  livonia: { world: 12800, tiles: "https://static.xam.nu/dayz/maps/livonia/1.27/satellite/{z}/{x}/{y}.webp", server: "101x" as const },
  chernarus: { world: 15360, tiles: "https://static.xam.nu/dayz/maps/chernarusplus/1.27/satellite/{z}/{x}/{y}.webp", server: "102x" as const },
};

function toMap(x: number, z: number, world: number): [number, number] {
  return [(z / world) * TILE - TILE, (x / world) * TILE];
}

function fromClick(lat: number, lng: number, world: number) {
  return {
    x: Math.min(world, Math.max(0, Math.round((lng / TILE) * world))),
    z: Math.min(world, Math.max(0, Math.round(((lat + TILE) / TILE) * world))),
  };
}

function rangeMeters(range: string) {
  return Number(range.replace(/[^\d]/g, "")) || 500;
}

function noteEnemy(name: string, x: number, z: number) {
  const text = `Enemy in your zone: ${name} at ${x}, ${z}`;
  const notes = JSON.parse(localStorage.getItem("asylumhub:notifs") || "[]") as Array<{ id: string; text: string; at: string }>;
  if (notes.some((note) => note.text.includes(name) && Date.now() - Date.parse(note.at) < 10 * 60 * 1000)) return;
  notes.unshift({ id: `${Date.now()}-${name}`, text, at: new Date().toISOString() });
  localStorage.setItem("asylumhub:notifs", JSON.stringify(notes.slice(0, 30)));
  window.dispatchEvent(new Event("asylumhub:notifs"));
  toast.error(text);
}

function Fit({ bounds, locked }: { bounds: L.LatLngBoundsExpression | null; locked: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [18, 18], maxZoom: locked ? 6 : 3, animate: true });
    if (locked) map.setMaxBounds(bounds);
  }, [bounds, locked, map]);
  return null;
}

function Clicks({ world, onPick }: { world: number; onPick: (x: number, z: number) => void }) {
  useMapEvents({
    click(event) {
      const next = fromClick(event.latlng.lat, event.latlng.lng, world);
      onPick(next.x, next.z);
    },
  });
  return null;
}

export function ZoneSquareMap({
  mapId,
  x,
  z,
  range,
  onPick,
  accessToken,
  factionMembers,
  selfNames,
}: {
  mapId: "livonia" | "chernarus";
  x?: number;
  z?: number;
  range: string;
  onPick: (x: number, z: number) => void;
  accessToken?: string;
  factionMembers: string[];
  selfNames: string[];
}) {
  const spec = MAPS[mapId];
  const meters = rangeMeters(range);
  const locked = Number.isFinite(x) && Number.isFinite(z);
  const bounds = locked
    ? L.latLngBounds(toMap((x as number) - meters, (z as number) - meters, spec.world), toMap((x as number) + meters, (z as number) + meters, spec.world))
    : null;
  const onlineQ = useQuery({
    queryKey: ["zone-players", spec.server],
    queryFn: () => getOnlinePlayers({ data: { accessToken } }),
    enabled: Boolean(accessToken) && locked,
    refetchInterval: 20_000,
  });
  const statsQ = useQuery({
    queryKey: ["zone-stats"],
    queryFn: () => getLeaderboards(),
    enabled: locked,
    staleTime: 60_000,
  });
  const stats = useMemo(() => {
    const map = new Map<string, PlayerStats>();
    for (const row of statsQ.data?.kills ?? []) map.set(row.displayName.toLocaleLowerCase(), row);
    return map;
  }, [statsQ.data]);
  const faction = useMemo(() => new Set(factionMembers.map((name) => name.toLocaleLowerCase())), [factionMembers]);
  const self = useMemo(() => new Set(selfNames.map((name) => name.toLocaleLowerCase())), [selfNames]);
  const inside = (onlineQ.data?.players ?? []).filter((player): player is OnlinePlayer & { x: number; z: number } => {
    if (player.server !== spec.server || !Number.isFinite(player.x) || !Number.isFinite(player.z) || !locked) return false;
    return Math.abs((player.x as number) - (x as number)) <= meters && Math.abs((player.z as number) - (z as number)) <= meters;
  });
  const enemyKey = inside
    .filter((player) => !self.has(player.name.toLocaleLowerCase()) && !faction.has(player.name.toLocaleLowerCase()))
    .map((player) => `${player.name}:${player.x}:${player.z}`)
    .join("|");
  useEffect(() => {
    if (!locked || !enemyKey) return;
    for (const part of enemyKey.split("|")) {
      const [name, px, pz] = part.split(":");
      noteEnemy(name, Number(px), Number(pz));
    }
  }, [enemyKey, locked]);

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-400/40 bg-black">
      <MapContainer
        key={`${mapId}-${locked ? "zone" : "pick"}`}
        crs={L.CRS.Simple}
        center={locked ? toMap(x as number, z as number, spec.world) : [-TILE / 2, TILE / 2]}
        zoom={locked ? 4 : 2}
        minZoom={0}
        maxZoom={8}
        maxBounds={locked ? bounds ?? undefined : L.latLngBounds([[-TILE, 0], [0, TILE]])}
        className="h-[68vh] w-full bg-[#11150f]"
        scrollWheelZoom
      >
        <TileLayer url={spec.tiles} bounds={L.latLngBounds([[-TILE, 0], [0, TILE]])} minZoom={0} maxNativeZoom={7} maxZoom={8} noWrap />
        <Clicks world={spec.world} onPick={onPick} />
        <Fit bounds={bounds} locked={locked} />
        {locked && bounds ? <Rectangle bounds={bounds} pathOptions={{ color: "#38bdf8", weight: 2, fillColor: "#38bdf8", fillOpacity: 0.18 }} /> : null}
        {locked ? (
          <CircleMarker
            center={toMap(x as number, z as number, spec.world)}
            radius={8}
            pathOptions={{ color: "#e0f2fe", fillColor: "#38bdf8", fillOpacity: 1 }}
            eventHandlers={{
              click: (event) => {
                L.DomEvent.stopPropagation(event.originalEvent);
                void navigator.clipboard.writeText(`${x}, ${z}`);
                toast.success(`Copied ${x}, ${z}`);
              },
            }}
          >
            <Tooltip direction="top">Center · click to copy</Tooltip>
          </CircleMarker>
        ) : null}
        {inside.map((player) => {
          const friendly = faction.has(player.name.toLocaleLowerCase());
          const row = stats.get(player.name.toLocaleLowerCase());
          return (
            <CircleMarker key={player.id} center={toMap(player.x, player.z, spec.world)} radius={6} pathOptions={{ color: "white", fillColor: friendly ? "#22c55e" : "#ef4444", fillOpacity: 1 }}>
              <Tooltip>
                <div className="text-xs">
                  <div>{player.name}</div>
                  {friendly ? <div>Discord · {player.name}</div> : null}
                  <div>KD {row?.kd ?? "—"} · {row?.kills ?? 0} kills · {row?.deaths ?? 0} deaths</div>
                  {friendly ? <div>Playtime {row?.playtime ?? "—"} · {row?.balance ?? 0} cr</div> : null}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
