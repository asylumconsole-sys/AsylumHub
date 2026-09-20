import type { SVGProps } from "react";
import "@/styles/gold-nav-icons.css";

type P = SVGProps<SVGSVGElement> & { size?: number };

function GoldSvg({ size = 18, children, ...p }: P & { children: React.ReactNode }) {
  return (
    <span className="gold-nav-icon" aria-hidden>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
        <defs>
          <linearGradient id="gGold" x1="4" y1="2" x2="20" y2="22">
            <stop offset="0%" stopColor="#fff1b8" />
            <stop offset="45%" stopColor="#f6be58" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>
        {children}
      </svg>
    </span>
  );
}

const s = { fill: "url(#gGold)", stroke: "#7c4a12", strokeWidth: 0.6 } as const;

export function GoldLobby(p: P) {
  return (
    <GoldSvg {...p}>
      <path {...s} d="M12 2.5 21 8v3H3V8l9-5.5Z" />
      <path {...s} d="M5 11h14v10H5z" />
      <path fill="#1a0e04" d="M11 14h2v7h-2z" />
    </GoldSvg>
  );
}
export function GoldServers(p: P) {
  return (
    <GoldSvg {...p}>
      <rect {...s} x="4" y="3" width="16" height="5" rx="1" />
      <rect {...s} x="4" y="9.5" width="16" height="5" rx="1" />
      <rect {...s} x="4" y="16" width="16" height="5" rx="1" />
      <circle cx="7.2" cy="5.5" r="0.7" fill="#1a0e04" />
      <circle cx="7.2" cy="12" r="0.7" fill="#1a0e04" />
      <circle cx="7.2" cy="18.5" r="0.7" fill="#1a0e04" />
    </GoldSvg>
  );
}
export function GoldOperations(p: P) {
  return (
    <GoldSvg {...p}>
      <path {...s} d="M4 19 12 4l8 15H4Z" />
      <circle cx="12" cy="13.5" r="2.2" fill="#1a0e04" />
    </GoldSvg>
  );
}
export function GoldMap(p: P) {
  return (
    <GoldSvg {...p}>
      <path {...s} d="M4 6.5 9 5l6 2 5-1.5v13L15 20l-6-2-5 1.5v-13Z" />
      <circle cx="13" cy="11" r="2.1" fill="#1a0e04" />
      <path fill="#1a0e04" d="M13 13.2 11.4 18h3.2L13 13.2Z" />
    </GoldSvg>
  );
}
export function GoldShop(p: P) {
  return (
    <GoldSvg {...p}>
      <path {...s} d="M5 9h14l-1.2 11H6.2L5 9Z" />
      <path {...s} d="M8 9V7a4 4 0 0 1 8 0v2" />
    </GoldSvg>
  );
}
export function GoldWarRoom(p: P) {
  return (
    <GoldSvg {...p}>
      <path {...s} d="M12 3 20 6.5v5.2c0 5-3.4 8.3-8 9.8-4.6-1.5-8-4.8-8-9.8V6.5L12 3Z" />
      <path fill="#1a0e04" d="M12 7.2 14.6 16h-5.2L12 7.2Z" />
    </GoldSvg>
  );
}
export function GoldChallenges(p: P) {
  return (
    <GoldSvg {...p}>
      <circle {...s} cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" stroke="#7c4a12" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="1.4" fill="#1a0e04" />
    </GoldSvg>
  );
}
export function GoldRewards(p: P) {
  return (
    <GoldSvg {...p}>
      <path {...s} d="M7 4h10v3a5 5 0 0 1-10 0V4Z" />
      <path {...s} d="M6 20h12v2H6z" />
      <path {...s} d="M9 12h6v8H9z" />
    </GoldSvg>
  );
}
export function GoldBattlepass(p: P) {
  return (
    <GoldSvg {...p}>
      <path {...s} d="M3 8h18v10H3z" />
      <path fill="#1a0e04" d="M6 11h5v2H6z" />
      <circle cx="16.5" cy="13" r="1.6" fill="#1a0e04" />
    </GoldSvg>
  );
}
export function GoldLocker(p: P) {
  return (
    <GoldSvg {...p}>
      <rect {...s} x="6" y="3" width="12" height="18" rx="1" />
      <path fill="#1a0e04" d="M14.2 11.2h1.6v3.2h-1.6z" />
      <path stroke="#7c4a12" d="M12 3v18" />
    </GoldSvg>
  );
}
export function GoldSettings(p: P) {
  return (
    <GoldSvg {...p}>
      <path {...s} d="M10.2 2.8h3.6l.7 2.4 2.3.9 2.2-1.3 2.5 2.5-1.3 2.2.9 2.3 2.4.7v3.6l-2.4.7-.9 2.3 1.3 2.2-2.5 2.5-2.2-1.3-2.3.9-.7 2.4h-3.6l-.7-2.4-2.3-.9-2.2 1.3-2.5-2.5 1.3-2.2-.9-2.3L2.8 13.8v-3.6l2.4-.7.9-2.3L4.8 5 7.3 2.5 9.5 3.8l2.3-.9.4-2.1Z" />
      <circle cx="12" cy="12" r="3.1" fill="#1a0e04" />
    </GoldSvg>
  );
}
