import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { HexToolsTree } from "@/components/tools/HexToolsTree";
import { HexToolsList } from "@/components/tools/HexToolsList";
import {
  FOCUSED_PRIMARY_IDS,
  FOCUSED_TOOLS,
  SATELLITE_TO_FOCUS_SLUG,
  getFocusedTool,
} from "@/components/tools/focused-tools";

const SQRT3 = Math.sqrt(3);
const S = 86;
const W = SQRT3 * S;
const H = 2 * S;
const STAGE_W = 1120;
const STAGE_H = 720;
const CX = STAGE_W / 2;
const SHIFT_X = -0.25 * W;
const COL_X = ((CX + SHIFT_X) % W + W) % W;
const TILE_W = W;
const TILE_H = 3 * S;

function poly(ox: number, oy: number, inset = 4) {
  const w = W - inset * 2;
  const h = H - inset * 2;
  const pts = [
    [ox + inset + w / 2, oy + inset],
    [ox + inset + w, oy + inset + h * 0.25],
    [ox + inset + w, oy + inset + h * 0.75],
    [ox + inset + w / 2, oy + inset + h],
    [ox + inset, oy + inset + h * 0.75],
    [ox + inset, oy + inset + h * 0.25],
  ];
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

const TILE_SVG = `
<svg xmlns='http://www.w3.org/2000/svg' width='${TILE_W}' height='${TILE_H}' viewBox='0 0 ${TILE_W} ${TILE_H}'>
  <g fill='none' stroke='currentColor' stroke-width='1.25' stroke-linejoin='round'>
    <polygon points='${poly(0, 0)}' />
    <polygon points='${poly(W / 2, 1.5 * S)}' />
    <polygon points='${poly(-W / 2, 1.5 * S)}' />
  </g>
</svg>
`.trim();

const TILE_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(TILE_SVG)}")`;
const VH_TOP = 380;
const VH_BOTTOM = 900;
const BG_Y_TOP = (((VH_TOP - 238) % TILE_H) + TILE_H) % TILE_H;
const BG_Y_BOTTOM = (((31 - 215) % TILE_H) + TILE_H) % TILE_H;
void STAGE_H;
void BG_Y_TOP;
void BG_Y_BOTTOM;
void TILE_URL;
void COL_X;

export function DashboardHexLauncher() {
  const navigate = useNavigate();

  const handleFocus = useCallback(
    (primaryId: string) => {
      const entry = Object.values(FOCUSED_TOOLS).find(
        (t) => t.primaryId === primaryId && !t.parentTitle,
      );
      if (!entry) return;
      navigate({ to: entry.fullRouteTo || "/tools", search: { focus: entry.slug } });
    },
    [navigate],
  );

  const handleSatelliteFocus = useCallback(
    (_primaryId: string, satelliteId: string) => {
      if (satelliteId === "vehicles" || satelliteId === "vehicle" || satelliteId === "vehicle-shop") {
        navigate({ to: "/tools/vehicle-shop" });
        return true;
      }
      const slug = SATELLITE_TO_FOCUS_SLUG[satelliteId];
      if (!slug) return false;
      const tool = getFocusedTool(slug);
      if (tool?.fullRouteTo && tool.fullRouteTo !== "/tools") {
        navigate({ to: tool.fullRouteTo });
        return true;
      }
      navigate({ to: "/tools", search: { focus: slug } });
      return true;
    },
    [navigate],
  );

  return (
    <section aria-label="Server tools" className="relative">
      <div aria-hidden className="dhl-shimmer" />
      <div className="dhl-stage relative mt-2 left-1/2 right-1/2 -translate-x-1/2 w-screen max-w-none hidden md:block">
        <div className="relative z-10 dhl-tree">
          <HexToolsTree
            onFocus={handleFocus}
            focusablePrimaryIds={FOCUSED_PRIMARY_IDS}
            onSatelliteFocus={handleSatelliteFocus}
            fadeGhostEdges
            radial
          />
        </div>
      </div>
      <div className="md:hidden mt-3">
        <HexToolsList
          onFocus={handleFocus}
          focusablePrimaryIds={FOCUSED_PRIMARY_IDS}
          onSatelliteFocus={handleSatelliteFocus}
        />
      </div>
      <style>{`
        .dhl-stage { container-type: inline-size; isolation: isolate; }
        .dhl-tree::before {
          content: "";
          position: absolute;
          inset: 22% 14%;
          z-index: -1;
          pointer-events: none;
          background: radial-gradient(ellipse 60% 55% at 50% 55%, oklch(0.75 0.18 290 / 0.22) 0%, oklch(0.65 0.15 260 / 0.10) 45%, transparent 78%);
          filter: blur(50px);
        }
        .dhl-shimmer { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 5; }
      `}</style>
    </section>
  );
}
