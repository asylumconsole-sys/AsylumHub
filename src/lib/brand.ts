/**
 * Centralized brand configuration for this template.
 */
export const BRAND = {
  name: "DayZ Pro",
  shortName: "DayZ Pro",
  tagline: "Command hub for your DayZ servers",
  description:
    "Track players, protect your base, run events, build NPCs, manage factions and spend credits — all in one place.",
  domain: "dayzpro.online",
  supportEmail: "support@dayzpro.online",
} as const;

export type Brand = typeof BRAND;
