export type VehicleVariant = {
  id: string;
  classname: string;
  color: string;
  hex: string;
  image: string;
};

export type ShopVehicle = {
  id: string;
  name: string;
  role: string;
  kind: "car" | "truck" | "boat" | "humvee";
  price: number;
  wiki: string;
  variants: VehicleVariant[];
};

function svg(kind: ShopVehicle["kind"], hex: string) {
  const body =
    kind === "boat"
      ? `<ellipse cx="120" cy="78" rx="88" ry="22" fill="${hex}"/><path d="M40 78 Q120 40 200 78" fill="${hex}" stroke="#111" stroke-width="2"/><rect x="96" y="48" width="48" height="16" rx="3" fill="#1a1a1a"/>`
      : kind === "truck"
        ? `<rect x="28" y="52" width="130" height="40" rx="4" fill="${hex}"/><rect x="150" y="40" width="58" height="52" rx="4" fill="${hex}"/><rect x="158" y="48" width="28" height="16" fill="#7ec8e3" opacity=".7"/><circle cx="58" cy="96" r="14" fill="#1a1a1a"/><circle cx="168" cy="96" r="14" fill="#1a1a1a"/>`
        : kind === "humvee"
          ? `<rect x="36" y="50" width="168" height="38" rx="6" fill="${hex}"/><rect x="70" y="36" width="90" height="22" rx="3" fill="${hex}"/><rect x="82" y="40" width="28" height="14" fill="#7ec8e3" opacity=".7"/><circle cx="62" cy="94" r="13" fill="#1a1a1a"/><circle cx="178" cy="94" r="13" fill="#1a1a1a"/>`
          : `<path d="M38 78 L58 52 H170 L202 78 Z" fill="${hex}"/><rect x="48" y="70" width="144" height="22" fill="${hex}"/><rect x="72" y="54" width="36" height="16" fill="#7ec8e3" opacity=".75"/><rect x="118" y="54" width="36" height="16" fill="#7ec8e3" opacity=".75"/><circle cx="70" cy="94" r="12" fill="#1a1a1a"/><circle cx="170" cy="94" r="12" fill="#1a1a1a"/>`;
  const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120"><rect width="240" height="120" fill="#0b0b0b"/><text x="12" y="20" fill="#d4a84b" font-size="10" font-family="sans-serif">DAYZ PRO</text>${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
}

function v(kind: ShopVehicle["kind"], classname: string, color: string, hex: string): VehicleVariant {
  return { id: classname.toLowerCase(), classname, color, hex, image: svg(kind, hex) };
}

export const VEHICLES: ShopVehicle[] = [
  {
    id: "ada",
    name: "Ada 4x4",
    role: "Off-road hatchback",
    kind: "car",
    price: 25_000,
    wiki: "https://dayz.fandom.com/wiki/Ada_4x4",
    variants: [
      v("car", "OffroadHatchback", "Green", "#3f6b32"),
      v("car", "OffroadHatchback_Blue", "Blue", "#1e4d8c"),
      v("car", "OffroadHatchback_White", "White", "#d6d6d6"),
    ],
  },
  {
    id: "gunter",
    name: "Gunter 2",
    role: "Compact hatchback",
    kind: "car",
    price: 22_000,
    wiki: "https://dayz.fandom.com/wiki/Gunter_2",
    variants: [
      v("car", "Hatchback_02", "Red", "#9b1c1c"),
      v("car", "Hatchback_02_Black", "Black", "#2a2a2a"),
      v("car", "Hatchback_02_Blue", "Blue", "#2459b8"),
    ],
  },
  {
    id: "olga",
    name: "Olga 24",
    role: "Civilian sedan",
    kind: "car",
    price: 28_000,
    wiki: "https://dayz.fandom.com/wiki/Olga_24",
    variants: [
      v("car", "CivilianSedan", "White", "#e8e8e8"),
      v("car", "CivilianSedan_Black", "Black", "#1c1c1c"),
      v("car", "CivilianSedan_Wine", "Wine", "#5a1420"),
    ],
  },
  {
    id: "sarka",
    name: "Sarka 120",
    role: "City sedan",
    kind: "car",
    price: 20_000,
    wiki: "https://dayz.fandom.com/wiki/Sarka_120",
    variants: [
      v("car", "Sedan_02", "Yellow", "#c9a227"),
      v("car", "Sedan_02_Grey", "Grey", "#7a7a7a"),
      v("car", "Sedan_02_Red", "Red", "#b42318"),
    ],
  },
  {
    id: "m3s",
    name: "M3S Truck",
    role: "Covered heavy truck",
    kind: "truck",
    price: 45_000,
    wiki: "https://dayz.fandom.com/wiki/M3S",
    variants: [
      v("truck", "Truck_01_Covered", "Green", "#35582b"),
      v("truck", "Truck_01_Covered_Blue", "Blue", "#1c3f86"),
      v("truck", "Truck_01_Covered_Orange", "Orange", "#c45a12"),
    ],
  },
  {
    id: "m3s-chassis",
    name: "M3S Chassis",
    role: "Bare truck frame",
    kind: "truck",
    price: 15_000,
    wiki: "https://dayz.fandom.com/wiki/M3S",
    variants: [v("truck", "Truck_01_Chassis", "Default", "#6a6a6a")],
  },
  {
    id: "m3s-cargo",
    name: "M3S Cargo",
    role: "Open cargo bed",
    kind: "truck",
    price: 18_000,
    wiki: "https://dayz.fandom.com/wiki/M3S",
    variants: [v("truck", "Truck_01_Cargo", "Default", "#4d4d4d")],
  },
  {
    id: "humvee",
    name: "M1025 Humvee",
    role: "Armored recon",
    kind: "humvee",
    price: 80_000,
    wiki: "https://dayz.fandom.com/wiki/M1025",
    variants: [v("humvee", "Offroad_02", "Military", "#4b5320")],
  },
  {
    id: "boat",
    name: "Rubber Boat",
    role: "Water transport",
    kind: "boat",
    price: 12_000,
    wiki: "https://dayz.fandom.com/wiki/Rubber_Boat",
    variants: [
      v("boat", "Boat_01_Blue", "Blue", "#1d4e89"),
      v("boat", "Boat_01_Orange", "Orange", "#d45a12"),
      v("boat", "Boat_01_Black", "Black", "#222"),
      v("boat", "Boat_01_Camo", "Camo", "#4a5a32"),
    ],
  },
];
