import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { DayZPageHeader } from "@/components/dayz/DayZPageHeader";
import { Button } from "@/components/ui/button";
import { IconCampaign, IconSearch } from "@/components/ui-custom/CustomIcon";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildDayZRoadRoute,
  loadDayZRoadGrid,
  type DayZMapPoint,
  type DayZRoadGrid,
  type DayZRouteResult,
} from "@/lib/dayz-road-routing";
import { getOnlinePlayers, type OnlinePlayer } from "@/lib/online-players.functions";
import { fireMapStrike, publishMapHeatmap, runRadarScan, type RadarMode, type StrikeKind } from "@/lib/map-ops.functions";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/_app/tools/base-map-clicker")({
  component: BaseMapClickerPage,
});

const TILE_SIZE = 256;
const MAP_BOUNDS = L.latLngBounds([[-TILE_SIZE, 0], [0, TILE_SIZE]]);
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
    subtitle: "ChernarusPlus satellite terrain",
    worldSize: 15360,
    serverId: "101x",
    tileUrl: "https://static.xam.nu/dayz/maps/chernarusplus/1.27/satellite/{z}/{x}/{y}.webp",
    topographicUrl: "https://static.xam.nu/dayz/maps/chernarusplus/1.27/topographic/{z}/{x}/{y}.webp",
    poiUrl: "https://static.xam.nu/dayz/json/chernarusplus/1.29-7.json",
    zoom: 2,
  },
  livonia: {
    label: "Livonia",
    subtitle: "DayZ Livonia satellite terrain",
    worldSize: 12800,
    serverId: "101x",
    tileUrl: "https://static.xam.nu/dayz/maps/livonia/1.27/satellite/{z}/{x}/{y}.webp",
    topographicUrl: "https://static.xam.nu/dayz/maps/livonia/1.27/topographic/{z}/{x}/{y}.webp",
    poiUrl: "https://static.xam.nu/dayz/json/livonia/1.29-7.json",
    zoom: 2,
  },
} as const;

type MapLocation = {
  w: string;
  p: [number, number];
  s: string[];
};

type MapIconGroup = {
  f?: string;
  w?: string;
  p?: Array<[[number, number], ...unknown[]]>;
};

type MapPoiData = {
  markers?: {
    locations?: MapLocation[];
    icons?: Record<string, MapIconGroup>;
  };
  nav?: {
    vehicle?: string[];
  };
};

type SearchLocation = {
  id: string;
  name: string;
  kind: string;
  position: [number, number];
};

type VehicleMarker = {
  id: string;
  name: string;
  imageUrl: string;
  wikiUrl: string;
  position: [number, number];
};

type StoredPlayerPosition = {
  x: number;
  z: number;
};

type FocusTarget = {
  id: number;
  position: [number, number];
};

type TacticalTool = StrikeKind | RadarMode | "heatmap";

function currentZoomFor(mapId: keyof typeof MAPS) {
  return MAPS[mapId].zoom;
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function displayName(value: string) {
  return value.replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

function gameToMapPosition(x: number, z: number, worldSize: number): [number, number] {
  return [(z / worldSize) * TILE_SIZE - TILE_SIZE, (x / worldSize) * TILE_SIZE];
}

function hasPosition(player: OnlinePlayer): player is OnlinePlayer & { x: number; z: number } {
  return Number.isFinite(player.x) && Number.isFinite(player.z);
}

const VEHICLE_DETAILS: Record<string, { name: string; imageUrl: string; wikiUrl: string }> = {
  vehicleoffroadhatchback: {
    name: "Ada 4x4",
    imageUrl: "https://static.wikia.nocookie.net/dayz_gamepedia/images/c/cc/Lada-niva.png/revision/latest?cb=20151219090954",
    wikiUrl: "https://dayz.fandom.com/wiki/Ada_4x4",
  },
  vehicleciviliansedan: {
    name: "Olga 24",
    imageUrl: "https://static.wikia.nocookie.net/dayz_gamepedia/images/3/38/Volga.png/revision/latest?cb=20151219090823",
    wikiUrl: "https://dayz.fandom.com/wiki/Olga_24",
  },
  vehiclehatchback02: {
    name: "Gunter 2",
    imageUrl: "https://static.wikia.nocookie.net/dayz_gamepedia/images/5/53/Hatchback_02.png/revision/latest?cb=20190522060629",
    wikiUrl: "https://dayz.fandom.com/wiki/Gunter_2",
  },
  vehiclesedan02: {
    name: "Sarka 120",
    imageUrl: "https://static.wikia.nocookie.net/dayz_gamepedia/images/6/6f/S120.png/revision/latest?cb=20190522063830",
    wikiUrl: "https://dayz.fandom.com/wiki/Sarka_120",
  },
  vehicletruck01: {
    name: "M3S",
    imageUrl: "https://static.wikia.nocookie.net/dayz_gamepedia/images/0/0d/M3S_Covered.png/revision/latest?cb=20210119100603",
    wikiUrl: "https://dayz.fandom.com/wiki/M3S",
  },
  vehicleoffroad02: {
    name: "M1025",
    imageUrl: "https://static.wikia.nocookie.net/dayz_gamepedia/images/9/93/M1025.png/revision/latest?cb=20230214060732",
    wikiUrl: "https://dayz.fandom.com/wiki/M1025",
  },
};

function vehicleIcon(vehicle: VehicleMarker, markerSize: number) {
  const height = markerSize * 5;
  const width = height * 1.5;
  return L.divIcon({
    className: "dayz-vehicle-icon",
    html: `<span class="dayz-vehicle-marker" title="${vehicle.name} spawn"><img src="${vehicle.imageUrl}" alt="" style="width:${width}px;height:${height}px;max-width:${width}px;max-height:${height}px" /></span>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
    tooltipAnchor: [0, -(height / 2)],
  });
}

function MapFocus({ target }: { target: FocusTarget | null }) {
  const leafletMap = useMap();
  useEffect(() => {
    if (!target) return;
    leafletMap.flyTo(target.position, Math.max(leafletMap.getZoom(), 5), { duration: 0.7 });
  }, [leafletMap, target]);
  return null;
}

function RouteFocus({ route }: { route: DayZRouteResult | null }) {
  const leafletMap = useMap();
  useEffect(() => {
    if (!route || route.path.length < 2) return;
    leafletMap.fitBounds(L.latLngBounds(route.path), { padding: [44, 44], maxZoom: 6 });
  }, [leafletMap, route]);
  return null;
}

function MapInteractions({
  worldSize,
  onPick,
  onZoom,
}: {
  worldSize: number;
  onPick: (lat: number, lng: number, x: number, z: number) => void;
  onZoom: (zoom: number) => void;
}) {
  useMapEvents({
    click(event) {
      const x = Math.round((event.latlng.lng / TILE_SIZE) * worldSize);
      const z = Math.round(((event.latlng.lat + TILE_SIZE) / TILE_SIZE) * worldSize);
      onPick(
        event.latlng.lat,
        event.latlng.lng,
        Math.min(worldSize, Math.max(0, x)),
        Math.min(worldSize, Math.max(0, z)),
      );
    },
    zoomend(event) {
      onZoom(event.target.getZoom());
    },
  });
  return null;
}

function BaseMapClickerPage() {
  const { session, user } = useAuth();
  const [map, setMap] = useState<keyof typeof MAPS>("livonia");
  const [picked, setPicked] = useState<{ lat: number; lng: number; x: number; z: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(currentZoomFor(map));
  const [showCars, setShowCars] = useState(true);
  const [showTownNames, setShowTownNames] = useState(true);
  const [markerSize, setMarkerSize] = useState(7);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [manualPlayerPosition, setManualPlayerPosition] = useState<StoredPlayerPosition | null>(null);
  const [routeMode, setRouteMode] = useState(false);
  const [routePoints, setRoutePoints] = useState<DayZMapPoint[]>([]);
  const [roadGrid, setRoadGrid] = useState<DayZRoadGrid | null>(null);
  const [roadLoadProgress, setRoadLoadProgress] = useState(0);
  const [routeResult, setRouteResult] = useState<DayZRouteResult | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [tacticalTool, setTacticalTool] = useState<TacticalTool>("airstrike");
  const [radius, setRadius] = useState(250);
  const [note, setNote] = useState("");
  const [heatPoints, setHeatPoints] = useState<Array<{ x: number; z: number; weight: number }>>([]);
  const [identity, setIdentity] = useState<{ playerNames: string[]; factionMembers: string[] }>({
    playerNames: [],
    factionMembers: [],
  });

  const currentMap = MAPS[map];
  const poiQ = useQuery({
    queryKey: ["dayz-map-pois", map],
    queryFn: async () => {
      const response = await fetch(currentMap.poiUrl);
      if (!response.ok) throw new Error(`Map markers unavailable (${response.status})`);
      return response.json() as Promise<MapPoiData>;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
  const onlineQ = useQuery({
    queryKey: ["dayz-map-players", currentMap.serverId],
    queryFn: () => getOnlinePlayers({ data: { accessToken: session?.access_token } }),
    enabled: Boolean(session?.access_token),
    refetchInterval: 15_000,
  });
  const coordText = useMemo(
    () => (picked ? `X ${picked.x} · Z ${picked.z}` : "Click anywhere on the map to pick a DayZ coordinate"),
    [picked],
  );
  const strikeMutation = useMutation({
    mutationFn: () => {
      if (!picked || !["airstrike", "gas", "strafe"].includes(tacticalTool)) throw new Error("Choose a strike target on the map");
      return fireMapStrike({ data: { kind: tacticalTool as StrikeKind, x: picked.x, z: picked.z, radius, map, serverId: currentMap.serverId, note } });
    },
    onSuccess: () => toast.success("Strike command sent"),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not send strike command"),
  });
  const radarMutation = useMutation({
    mutationFn: () => {
      if (!picked || !["base", "counter_uav"].includes(tacticalTool)) throw new Error("Choose a scan point on the map");
      return runRadarScan({ data: { mode: tacticalTool as RadarMode, x: picked.x, z: picked.z, radius, map, serverId: currentMap.serverId } });
    },
    onSuccess: () => toast.success("Radar scan started"),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not start radar scan"),
  });
  const heatmapMutation = useMutation({
    mutationFn: () => publishMapHeatmap({ data: { map, points: heatPoints, serverId: currentMap.serverId } }),
    onSuccess: (result) => {
      setHeatPoints([]);
      toast.success(`Published ${result.count} heatmap points`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not publish heatmap"),
  });

  useEffect(() => {
    const metadataName = typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : "";
    const playerNames = [
      window.localStorage.getItem("asylumhub:psn-name") ?? "",
      window.localStorage.getItem("asylumhub:psn-id") ?? "",
      metadataName,
    ].filter(Boolean);
    let factionMembers: string[] = [];
    try {
      const profile = JSON.parse(window.localStorage.getItem("asylumhub:faction-profile") ?? "null") as { members?: unknown[] } | null;
      factionMembers = (profile?.members ?? []).filter((member): member is string => typeof member === "string");
    } catch {
      factionMembers = [];
    }
    setIdentity({ playerNames, factionMembers });
  }, [user]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(`asylumhub:map-position:${map}`) ?? "null") as StoredPlayerPosition | null;
      setManualPlayerPosition(saved && Number.isFinite(saved.x) && Number.isFinite(saved.z) ? saved : null);
    } catch {
      setManualPlayerPosition(null);
    }
  }, [map]);

  useEffect(() => {
    if (!routeMode) return;
    let cancelled = false;
    setRoadGrid(null);
    setRoadLoadProgress(0);
    setRouteError(null);
    void loadDayZRoadGrid(currentMap.topographicUrl, (progress) => {
      if (!cancelled) setRoadLoadProgress(progress);
    }).then((grid) => {
      if (!cancelled) {
        setRoadGrid(grid);
        setRoadLoadProgress(1);
      }
    }).catch((error) => {
      if (!cancelled) setRouteError(error instanceof Error ? error.message : "Road data could not be loaded.");
    });
    return () => {
      cancelled = true;
    };
  }, [currentMap.topographicUrl, routeMode]);

  useEffect(() => {
    if (!routeMode || !roadGrid || routePoints.length !== 2) return;
    let cancelled = false;
    setRouteBusy(true);
    setRouteError(null);
    const timer = window.setTimeout(() => {
      try {
        const result = buildDayZRoadRoute(roadGrid, routePoints[0], routePoints[1], currentMap.worldSize);
        if (!cancelled) setRouteResult(result);
      } catch (error) {
        if (!cancelled) setRouteError(error instanceof Error ? error.message : "Route calculation failed.");
      } finally {
        if (!cancelled) setRouteBusy(false);
      }
    }, 30);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentMap.worldSize, roadGrid, routeMode, routePoints]);

  const locations = useMemo<SearchLocation[]>(() => (
    poiQ.data?.markers?.locations ?? []
  ).filter((location) => Array.isArray(location.p) && typeof location.s?.[0] === "string").map((location, index) => ({
    id: `${location.w}-${location.s[0]}-${index}`,
    name: displayName(location.s[0]),
    kind: location.w,
    position: location.p,
  })), [poiQ.data]);

  const towns = useMemo(
    () => locations.filter((location) => location.kind === "city" || location.kind === "village"),
    [locations],
  );

  const vehicleMarkers = useMemo<VehicleMarker[]>(() => {
    const markerGroups = poiQ.data?.markers?.icons ?? {};
    const allowedTypes = new Set(poiQ.data?.nav?.vehicle ?? []);
    return Object.entries(markerGroups).flatMap(([groupId, group]) => {
      if (group.f !== "vehicle" || !group.w || !allowedTypes.has(group.w)) return [];
      const details = VEHICLE_DETAILS[group.w];
      if (!details) return [];
      return (group.p ?? []).flatMap((record, index) => {
        const position = record[0];
        if (!Array.isArray(position) || !Number.isFinite(position[0]) || !Number.isFinite(position[1])) return [];
        return [{ id: `${groupId}-${index}`, ...details, position }];
      });
    });
  }, [poiQ.data]);

  const searchResults = useMemo(() => {
    const term = normalizeName(search);
    if (!term) return [];
    return locations.filter((location) => normalizeName(location.name).includes(term)).slice(0, 7);
  }, [locations, search]);

  const positionedPlayers = useMemo(
    () => (onlineQ.data?.players ?? []).filter((player) => player.server === currentMap.serverId && hasPosition(player) && player.x >= 0 && player.z >= 0 && player.x <= currentMap.worldSize && player.z <= currentMap.worldSize),
    [currentMap.serverId, currentMap.worldSize, onlineQ.data],
  );
  const playerNameSet = useMemo(() => new Set(identity.playerNames.map(normalizeName)), [identity.playerNames]);
  const factionNameSet = useMemo(() => new Set(identity.factionMembers.map(normalizeName)), [identity.factionMembers]);
  const currentPlayer = positionedPlayers.find((player) => playerNameSet.has(normalizeName(player.name)));
  const factionPlayers = positionedPlayers.filter(
    (player) => !playerNameSet.has(normalizeName(player.name)) && factionNameSet.has(normalizeName(player.name)),
  );
  const currentPlayerPosition = currentPlayer
    ? gameToMapPosition(currentPlayer.x, currentPlayer.z, currentMap.worldSize)
    : manualPlayerPosition
      ? gameToMapPosition(manualPlayerPosition.x, manualPlayerPosition.z, currentMap.worldSize)
      : null;

  const selectSearchResult = (location: SearchLocation) => {
    setSearch(location.name);
    setSearchOpen(false);
    setFocusTarget({ id: Date.now(), position: location.position });
  };

  const savePickedAsPlayerPosition = () => {
    if (!picked) return;
    const next = { x: picked.x, z: picked.z };
    window.localStorage.setItem(`asylumhub:map-position:${map}`, JSON.stringify(next));
    setManualPlayerPosition(next);
  };

  const clearRoute = () => {
    setRoutePoints([]);
    setRouteResult(null);
    setRouteError(null);
    setRouteBusy(false);
  };

  const toggleRouteMode = () => {
    setRouteMode((active) => !active);
    clearRoute();
  };

  const handleMapPick = (lat: number, lng: number, x: number, z: number) => {
    if (routeMode) {
      const point: DayZMapPoint = [lat, lng];
      setRoutePoints((current) => current.length >= 2 ? [point] : [...current, point]);
      setRouteResult(null);
      setRouteError(null);
      return;
    }
    if (tacticalTool === "heatmap") {
      setHeatPoints((current) => [...current, { x, z, weight: 1 }].slice(-200));
      return;
    }
    setPicked({ lat, lng, x, z });
  };

  const switchMap = (mapId: keyof typeof MAPS) => {
    setMap(mapId);
    setZoomLevel(currentZoomFor(mapId));
    setPicked(null);
    setSearch("");
    setSearchOpen(false);
    setFocusTarget(null);
    setHeatPoints([]);
    clearRoute();
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-7xl flex-col gap-4 px-4 py-6">
      <DayZPageHeader
        title="Map"
        subtitle="Interactive Livonia and Chernarus map"
        icon={<IconCampaign size={16} />}
        hue={150}
        actions={
          <div className="flex items-center gap-2">
            {(Object.keys(MAPS) as Array<keyof typeof MAPS>).map((key) => (
              <Button key={key} type="button" variant={map === key ? "default" : "outline"} onClick={() => switchMap(key)}>
                {MAPS[key].label}
              </Button>
            ))}
          </div>
        }
      />

      <GlassPanel className="overflow-hidden p-0 shadow-2xl">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="relative min-h-[72vh] bg-black">
            <div className="absolute left-14 right-4 top-4 z-[1000] max-w-md">
              <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/80 px-3 shadow-xl backdrop-blur-md">
                <IconSearch size={16} className="shrink-0 text-primary" />
                <input
                  value={search}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSearchOpen(true);
                  }}
                  placeholder={`Search ${currentMap.label} locations`}
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
              {searchOpen && searchResults.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-xl border border-white/15 bg-black/90 p-1 shadow-2xl backdrop-blur-xl">
                  {searchResults.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      onClick={() => selectSearchResult(location)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-white/10"
                    >
                      <span>{location.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{location.kind}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <MapContainer
              key={map}
              crs={L.CRS.Simple}
              center={MAP_CENTER}
              zoom={zoomLevel}
              minZoom={0}
              maxZoom={9}
              maxBounds={MAP_BOUNDS}
              maxBoundsViscosity={1}
              className="h-full min-h-[72vh] w-full bg-[#11150f]"
              scrollWheelZoom
            >
              <TileLayer
                attribution='DayZ map imagery &copy; XAM · Vehicle images <a href="https://dayz.fandom.com/wiki/Vehicles" target="_blank" rel="noreferrer">DayZ Wiki contributors</a> (CC BY-NC-SA)'
                url={currentMap.tileUrl}
                bounds={MAP_BOUNDS}
                minZoom={0}
                maxNativeZoom={7}
                maxZoom={9}
                noWrap
              />
              <MapInteractions
                worldSize={currentMap.worldSize}
                onPick={handleMapPick}
                onZoom={setZoomLevel}
              />
              <MapFocus target={focusTarget} />
              <RouteFocus route={routeResult} />
              {routeResult && routePoints[0] && (
                <Polyline
                  positions={[routePoints[0], routeResult.snappedStart]}
                  pathOptions={{ color: "#f8fafc", weight: 2, opacity: 0.8, dashArray: "5 7" }}
                />
              )}
              {routeResult && routePoints[1] && (
                <Polyline
                  positions={[routeResult.snappedEnd, routePoints[1]]}
                  pathOptions={{ color: "#f8fafc", weight: 2, opacity: 0.8, dashArray: "5 7" }}
                />
              )}
              {routeResult && (
                <Polyline
                  positions={routeResult.path}
                  pathOptions={{ color: "#22d3ee", weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
                />
              )}
              {routePoints[0] && (
                <CircleMarker
                  center={routePoints[0]}
                  radius={7}
                  pathOptions={{ color: "#dcfce7", fillColor: "#22c55e", fillOpacity: 1, weight: 2 }}
                >
                  <Tooltip permanent direction="top" offset={[0, -7]} className="dayz-route-tooltip">Start</Tooltip>
                </CircleMarker>
              )}
              {routePoints[1] && (
                <CircleMarker
                  center={routePoints[1]}
                  radius={7}
                  pathOptions={{ color: "#fee2e2", fillColor: "#ef4444", fillOpacity: 1, weight: 2 }}
                >
                  <Tooltip permanent direction="top" offset={[0, -7]} className="dayz-route-tooltip">Finish</Tooltip>
                </CircleMarker>
              )}
              {showTownNames && towns.map((town) => (
                <CircleMarker
                  key={town.id}
                  center={town.position}
                  radius={2}
                  pathOptions={{ color: "#f5e6bd", fillColor: "#11130f", fillOpacity: 0.9, weight: 1 }}
                >
                  <Tooltip permanent direction="top" offset={[0, -2]} className="dayz-town-tooltip">{town.name}</Tooltip>
                </CircleMarker>
              ))}
              {showCars && zoomLevel < 4 && vehicleMarkers.map((vehicle) => (
                <CircleMarker
                  key={vehicle.id}
                  center={vehicle.position}
                  radius={Math.max(2, markerSize * 0.38)}
                  pathOptions={{ color: "#fed7aa", fillColor: "#f97316", fillOpacity: 0.95, weight: 1.2 }}
                >
                  <Tooltip direction="top">{vehicle.name} · zoom in for image</Tooltip>
                </CircleMarker>
              ))}
              {showCars && zoomLevel >= 4 && vehicleMarkers.map((vehicle) => (
                <Marker
                  key={vehicle.id}
                  position={vehicle.position}
                  icon={vehicleIcon(vehicle, markerSize)}
                >
                  <Tooltip direction="top" className="dayz-vehicle-tooltip">
                    <span className="block font-semibold">{vehicle.name}</span>
                    <span className="block text-[9px] opacity-70">Vehicle spawn · DayZ Wiki image</span>
                  </Tooltip>
                </Marker>
              ))}
              {currentPlayerPosition && (
                <CircleMarker
                  center={currentPlayerPosition}
                  radius={markerSize}
                  pathOptions={{ color: "#dcfce7", fillColor: "#22c55e", fillOpacity: 1, weight: 2 }}
                >
                  <Tooltip permanent direction="top" offset={[0, -markerSize]} className="dayz-player-tooltip dayz-player-tooltip-self">
                    {currentPlayer?.name ?? identity.playerNames[0] ?? "You"}
                  </Tooltip>
                </CircleMarker>
              )}
              {factionPlayers.map((player) => (
                <CircleMarker
                  key={player.id}
                  center={gameToMapPosition(player.x, player.z, currentMap.worldSize)}
                  radius={Math.max(4, markerSize - 1)}
                  pathOptions={{ color: "#dbeafe", fillColor: "#3b82f6", fillOpacity: 1, weight: 2 }}
                >
                  <Tooltip permanent direction="top" offset={[0, -markerSize]} className="dayz-player-tooltip dayz-player-tooltip-faction">
                    {player.name}
                  </Tooltip>
                </CircleMarker>
              ))}
              {picked && <Marker position={[picked.lat, picked.lng]} icon={markerIcon} />}
            </MapContainer>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_58%,rgba(0,0,0,0.14)_100%)]" />
            <div className="absolute bottom-4 left-4 z-20 rounded-2xl border border-glass-border bg-black/70 px-4 py-3 text-xs text-muted-foreground backdrop-blur-md">
              {routeMode
                ? routePoints.length === 0
                  ? "Route mode: select the starting point."
                  : routePoints.length === 1
                    ? "Route mode: select the destination."
                    : routeBusy
                      ? "Calculating the road route..."
                      : "Route ready. Click again to start a new route."
                : "Click to place a marker. Use the right rail to switch terrain."}
            </div>
          </div>

          <div className="border-t border-glass-border bg-black/70 p-5 lg:border-l lg:border-t-0">
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Current map</div>
            <h2 className="mt-2 font-display text-2xl text-primary">{currentMap.label}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{currentMap.subtitle}</p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                aria-pressed={routeMode}
                onClick={toggleRouteMode}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${routeMode ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100" : "border-glass-border text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}
              >
                <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-cyan-400" /> Route</span>
                <span className="font-mono text-xs">{routeMode ? "On" : "Off"}</span>
              </button>
              {routeMode && (
                <div className="rounded-xl border border-cyan-300/25 bg-cyan-400/[0.06] p-3 text-xs">
                  {!roadGrid && !routeError && (
                    <div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Building road map</span>
                        <span className="font-mono text-cyan-100">{Math.round(roadLoadProgress * 100)}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-cyan-400 transition-[width]" style={{ width: `${roadLoadProgress * 100}%` }} />
                      </div>
                    </div>
                  )}
                  {roadGrid && routePoints.length < 2 && (
                    <p className="text-muted-foreground">{routePoints.length === 0 ? "Select a start point on the map." : "Now select the destination."}</p>
                  )}
                  {routeBusy && <p className="text-cyan-100">Snapping to roads and calculating GPS route...</p>}
                  {routeResult && !routeBusy && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between"><span className="text-muted-foreground">Distance</span><strong className="font-mono text-cyan-100">{(routeResult.distanceMeters / 1000).toFixed(1)} km</strong></div>
                      <div className="flex items-center justify-between"><span className="text-muted-foreground">Road lock</span><strong className="font-mono text-cyan-100">{Math.round(routeResult.roadCoverage * 100)}%</strong></div>
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={clearRoute}>Clear route</Button>
                    </div>
                  )}
                  {routeError && <p className="text-red-300">{routeError}</p>}
                </div>
              )}
              <button
                type="button"
                aria-pressed={showCars}
                onClick={() => setShowCars((value) => !value)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition ${showCars ? "border-orange-400/45 bg-orange-400/10 text-orange-100" : "border-glass-border text-muted-foreground hover:bg-white/5"}`}
              >
                <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-orange-500" /> Cars</span>
                <span className="font-mono text-xs">{showCars ? vehicleMarkers.length : "Off"}</span>
              </button>
              <button
                type="button"
                aria-pressed={showTownNames}
                onClick={() => setShowTownNames((value) => !value)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition ${showTownNames ? "border-primary/45 bg-primary/10 text-foreground" : "border-glass-border text-muted-foreground hover:bg-white/5"}`}
              >
                <span>Town names</span>
                <span className="font-mono text-xs">{showTownNames ? towns.length : "Off"}</span>
              </button>
            </div>
            <label className="mt-4 block rounded-xl border border-glass-border bg-white/[0.03] p-3">
              <span className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Marker size <span className="font-mono text-foreground">{markerSize}px</span>
              </span>
              <input
                type="range"
                min="4"
                max="12"
                step="1"
                value={markerSize}
                onChange={(event) => setMarkerSize(Number(event.target.value))}
                className="mt-3 w-full accent-primary"
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-glass-border bg-white/[0.03] p-3">
                <div className="uppercase tracking-[0.18em] text-muted-foreground">Zoom</div>
                <div className="mt-1 font-mono text-base text-foreground">{zoomLevel}</div>
              </div>
              <div className="rounded-xl border border-glass-border bg-white/[0.03] p-3">
                <div className="uppercase tracking-[0.18em] text-muted-foreground">Marker</div>
                <div className="mt-1 font-mono text-base text-foreground">{picked ? "Placed" : "None"}</div>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-glass-border bg-white/[0.03] p-4 text-sm text-foreground">{coordText}</div>
            <div className="mt-4 space-y-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-primary">Tactical command</div>
              <select value={tacticalTool} onChange={(event) => setTacticalTool(event.target.value as TacticalTool)} className="h-10 w-full rounded-lg border border-glass-border bg-black/30 px-3 text-sm">
                <option value="airstrike">Airstrike</option>
                <option value="gas">Gas strike</option>
                <option value="strafe">Strafe run</option>
                <option value="base">Base radar</option>
                <option value="counter_uav">Counter-UAV radar</option>
                <option value="heatmap">Heatmap</option>
              </select>
              {tacticalTool === "heatmap" ? (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setHeatPoints([])} disabled={heatPoints.length === 0}>Clear ({heatPoints.length})</Button>
                  <Button type="button" className="flex-1" onClick={() => heatmapMutation.mutate()} disabled={heatmapMutation.isPending || heatPoints.length === 0}>{heatmapMutation.isPending ? "Publishing" : "Publish"}</Button>
                </div>
              ) : (
                <>
                  <label className="block text-xs text-muted-foreground">Radius: {radius} m<input type="range" min="50" max="2000" step="50" value={radius} onChange={(event) => setRadius(Number(event.target.value))} className="mt-2 w-full accent-primary" /></label>
                  {["airstrike", "gas", "strafe"].includes(tacticalTool) && <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Command note (optional)" className="h-10 w-full rounded-lg border border-glass-border bg-black/30 px-3 text-sm" />}
                  <Button type="button" className="w-full" disabled={!picked || strikeMutation.isPending || radarMutation.isPending} onClick={() => (["airstrike", "gas", "strafe"].includes(tacticalTool) ? strikeMutation : radarMutation).mutate()}>{strikeMutation.isPending || radarMutation.isPending ? "Sending" : tacticalTool === "base" ? "Run base radar" : tacticalTool === "counter_uav" ? "Run counter-UAV" : `Fire ${tacticalTool}`}</Button>
                </>
              )}
            </div>
            {picked && (
              <Button type="button" variant="outline" className="mt-3 w-full" onClick={savePickedAsPlayerPosition}>
                Set as my location
              </Button>
            )}
            <div className="mt-4 space-y-2 rounded-2xl border border-glass-border bg-white/[0.03] p-4 text-xs">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-green-500" /> Your location</span><span className="text-muted-foreground">{currentPlayer ? "Live" : manualPlayerPosition ? "Saved" : "Waiting"}</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-blue-500" /> Faction members</span><span className="font-mono text-muted-foreground">{factionPlayers.length}</span></div>
            </div>
            {poiQ.error && <p className="mt-3 text-xs text-red-300">{poiQ.error instanceof Error ? poiQ.error.message : "Map markers unavailable"}</p>}
            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-xs leading-relaxed text-muted-foreground">
              Green is your linked PSN position. Blue markers are online faction members. When server logs do not expose a position, click the map and save a local location.
            </div>
          </div>
        </div>
      </GlassPanel>
      <style>{`
        .dayz-town-tooltip.leaflet-tooltip,
        .dayz-player-tooltip.leaflet-tooltip,
        .dayz-vehicle-tooltip.leaflet-tooltip,
        .dayz-route-tooltip.leaflet-tooltip {
          border: 0;
          box-shadow: none;
          font-family: inherit;
          pointer-events: none;
          white-space: nowrap;
        }
        .dayz-town-tooltip.leaflet-tooltip {
          background: rgba(8, 10, 7, 0.78);
          color: #f8edcf;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0;
          padding: 2px 5px;
          text-shadow: 0 1px 2px #000;
        }
        .dayz-player-tooltip.leaflet-tooltip {
          background: rgba(5, 8, 7, 0.9);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 6px;
        }
        .dayz-vehicle-icon { background: transparent; border: 0; }
        .dayz-vehicle-marker {
          position: relative;
          display: grid;
          width: 100%;
          height: 100%;
          place-items: center;
          background: transparent;
        }
        .dayz-vehicle-marker img {
          position: absolute;
          inset: 0;
          display: block;
          object-fit: contain;
          filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.95));
        }
        .dayz-vehicle-tooltip.leaflet-tooltip {
          background: rgba(8, 8, 7, 0.94);
          color: #fff7ed;
          font-size: 10px;
          padding: 5px 7px;
        }
        .dayz-route-tooltip.leaflet-tooltip {
          border: 1px solid rgba(34, 211, 238, 0.55);
          background: rgba(5, 12, 14, 0.92);
          color: #cffafe;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 6px;
        }
        .dayz-town-tooltip.leaflet-tooltip::before,
        .dayz-player-tooltip.leaflet-tooltip::before,
        .dayz-vehicle-tooltip.leaflet-tooltip::before,
        .dayz-route-tooltip.leaflet-tooltip::before { display: none; }
        .dayz-player-tooltip-self.leaflet-tooltip { border: 1px solid rgba(34, 197, 94, 0.65); }
        .dayz-player-tooltip-faction.leaflet-tooltip { border: 1px solid rgba(59, 130, 246, 0.65); }
      `}</style>
    </div>
  );
}
