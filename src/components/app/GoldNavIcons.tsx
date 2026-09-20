import type { SVGProps } from "react";
import "@/styles/gold-nav-icons.css";

type P = SVGProps<SVGSVGElement> & { size?: number };

function I({ size = 18, children, ...p }: P & { children: React.ReactNode }) {
  return (
    <span className="gold-nav-icon" aria-hidden>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
        {children}
      </svg>
    </span>
  );
}

export function GoldLobby(p: P) {
  return <I {...p}><path d="M4 20V10l8-6 8 6v10" /><path d="M10 20v-6h4v6" /></I>;
}
export function GoldServers(p: P) {
  return <I {...p}><rect x="4" y="4" width="16" height="5" /><rect x="4" y="10.5" width="16" height="5" /><rect x="4" y="17" width="16" height="4" /><path d="M7 6.5h.01M7 13h.01M7 19h.01" /></I>;
}
export function GoldOperations(p: P) {
  return <I {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></I>;
}
export function GoldMap(p: P) {
  return <I {...p}><path d="M4 7l5-2 6 2 5-2v12l-5 2-6-2-5 2z" /><path d="M9 5v12M15 7v12" /></I>;
}
export function GoldShop(p: P) {
  return <I {...p}><path d="M6 9h12l-1 11H7L6 9z" /><path d="M9 9V8a3 3 0 0 1 6 0v1" /></I>;
}
export function GoldWarRoom(p: P) {
  return <I {...p}><path d="M12 3 20 7v5c0 5-3.2 8-8 9-4.8-1-8-4-8-9V7l8-4z" /></I>;
}
export function GoldChallenges(p: P) {
  return <I {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" /></I>;
}
export function GoldRewards(p: P) {
  return <I {...p}><path d="M8 5h8v3a4 4 0 0 1-8 0V5z" /><path d="M10 12h4v7h-4z" /><path d="M8 21h8" /></I>;
}
export function GoldBattlepass(p: P) {
  return <I {...p}><rect x="3" y="7" width="18" height="10" rx="2" /><path d="M7 11h4" /><circle cx="16" cy="12" r="1.2" /></I>;
}
export function GoldLocker(p: P) {
  return <I {...p}><rect x="6" y="3" width="12" height="18" rx="1" /><path d="M12 3v18" /><path d="M14.5 12h1.5" /></I>;
}
export function GoldSettings(p: P) {
  return <I {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3V21M4.7 7.2l1.9 1.1M17.4 15.7l1.9 1.1M4.7 16.8l1.9-1.1M17.4 8.3l1.9-1.1" /></I>;
}
