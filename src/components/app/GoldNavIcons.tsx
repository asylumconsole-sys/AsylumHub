import { useId, type ReactNode, type SVGProps } from "react";
import "@/styles/gold-nav-icons.css";

type P = SVGProps<SVGSVGElement> & { size?: number };

function GoldSvg({ size = 18, children, ...p }: P & { children: ReactNode }) {
  const id = useId().replace(/:/g, "");
  const gid = `gGold${id}`;
  return (
    <span className="gold-nav-icon" aria-hidden>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
        <defs>
          <linearGradient id={gid} x1="4" y1="2" x2="20" y2="22">
            <stop offset="0%" stopColor="#fff1b8" />
            <stop offset="45%" stopColor="#f6be58" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>
        <g fill={`url(#${gid})`} stroke="#7c4a12" strokeWidth={0.6}>
          {children}
        </g>
      </svg>
    </span>
  );
}

export function GoldLobby(p: P) {
  return (
    <GoldSvg {...p}>
      <path d="M12 2.5 21 8v3H3V8l9-5.5Z" />
      <path d="M5 11h14v10H5z" />
      <path fill="#1a0e04" stroke="none" d="M11 14h2v7h-2z" />
    </GoldSvg>
  );
}
export function GoldServers(p: P) {
  return (
    <GoldSvg {...p}>
      <rect x="4" y="3" width="16" height="5" rx="1" />
      <rect x="4" y="9.5" width="16" height="5" rx="1" />
      <rect x="4" y="16" width="16" height="5" rx="1" />
    </GoldSvg>
  );
}
export function GoldOperations(p: P) {
  return (
    <GoldSvg {...p}>
      <path d="M4 19 12 4l8 15H4Z" />
    </GoldSvg>
  );
}
export function GoldMap(p: P) {
  return (
    <GoldSvg {...p}>
      <path d="M4 6.5 9 5l6 2 5-1.5v13L15 20l-6-2-5 1.5v-13Z" />
    </GoldSvg>
  );
}
export function GoldShop(p: P) {
  return (
    <GoldSvg {...p}>
      <path d="M5 9h14l-1.2 11H6.2L5 9Z" />
      <path d="M8 9V7a4 4 0 0 1 8 0v2" />
    </GoldSvg>
  );
}
export function GoldWarRoom(p: P) {
  return (
    <GoldSvg {...p}>
      <path d="M12 3 20 6.5v5.2c0 5-3.4 8.3-8 9.8-4.6-1.5-8-4.8-8-9.8V6.5L12 3Z" />
    </GoldSvg>
  );
}
export function GoldChallenges(p: P) {
  return (
    <GoldSvg {...p}>
      <circle cx="12" cy="12" r="8.5" />
    </GoldSvg>
  );
}
export function GoldRewards(p: P) {
  return (
    <GoldSvg {...p}>
      <path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" />
      <path d="M9 12h6v8H9z" />
      <path d="M6 20h12v2H6z" />
    </GoldSvg>
  );
}
export function GoldBattlepass(p: P) {
  return (
    <GoldSvg {...p}>
      <path d="M3 8h18v10H3z" />
    </GoldSvg>
  );
}
export function GoldLocker(p: P) {
  return (
    <GoldSvg {...p}>
      <rect x="6" y="3" width="12" height="18" rx="1" />
    </GoldSvg>
  );
}
export function GoldSettings(p: P) {
  return (
    <GoldSvg {...p}>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="3" fill="#1a0e04" stroke="none" />
    </GoldSvg>
  );
}
