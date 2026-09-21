export type VehicleVariant = {
  id: string;
  classname: string;
  color: string;
  image: string;
};

export type ShopVehicle = {
  id: string;
  name: string;
  role: string;
  price: number;
  wiki: string;
  variants: VehicleVariant[];
};

function wikiFile(name: string) {
  return `https://dayz.fandom.com/wiki/Special:FilePath/${encodeURIComponent(name)}`;
}

function v(classname: string, color: string, file?: string): VehicleVariant {
  return {
    id: classname.toLowerCase(),
    classname,
    color,
    image: wikiFile(file || `${classname}.png`),
  };
}

export const VEHICLES: ShopVehicle[] = [
  {
    id: "ada",
    name: "Ada 4x4",
    role: "Off-road hatchback",
    price: 25_000,
    wiki: "https://dayz.fandom.com/wiki/Ada_4x4",
    variants: [
      v("OffroadHatchback", "Green", "OffroadHatchback.png"),
      v("OffroadHatchback_Blue", "Blue", "OffroadHatchback_Blue.png"),
      v("OffroadHatchback_White", "White", "OffroadHatchback_White.png"),
    ],
  },
  {
    id: "gunter",
    name: "Gunter 2",
    role: "Compact hatchback",
    price: 22_000,
    wiki: "https://dayz.fandom.com/wiki/Gunter_2",
    variants: [
      v("Hatchback_02", "Red", "Hatchback_02.png"),
      v("Hatchback_02_Black", "Black", "Hatchback_02_Black.png"),
      v("Hatchback_02_Blue", "Blue", "Hatchback_02_Blue.png"),
    ],
  },
  {
    id: "olga",
    name: "Olga 24",
    role: "Civilian sedan",
    price: 28_000,
    wiki: "https://dayz.fandom.com/wiki/Olga_24",
    variants: [
      v("CivilianSedan", "White", "CivilianSedan.png"),
      v("CivilianSedan_Black", "Black", "CivilianSedan_Black.png"),
      v("CivilianSedan_Wine", "Wine", "CivilianSedan_Wine.png"),
    ],
  },
  {
    id: "sarka",
    name: "Sarka 120",
    role: "City sedan",
    price: 20_000,
    wiki: "https://dayz.fandom.com/wiki/Sarka_120",
    variants: [
      v("Sedan_02", "Yellow", "Sedan_02.png"),
      v("Sedan_02_Grey", "Grey", "Sedan_02_Grey.png"),
      v("Sedan_02_Red", "Red", "Sedan_02_Red.png"),
    ],
  },
  {
    id: "m3s",
    name: "M3S Truck",
    role: "Covered heavy truck",
    price: 45_000,
    wiki: "https://dayz.fandom.com/wiki/M3S",
    variants: [
      v("Truck_01_Covered", "Green", "Truck_01_Covered.png"),
      v("Truck_01_Covered_Blue", "Blue", "Truck_01_Covered_Blue.png"),
      v("Truck_01_Covered_Orange", "Orange", "Truck_01_Covered_Orange.png"),
    ],
  },
  {
    id: "m3s-chassis",
    name: "M3S Chassis",
    role: "Bare truck frame",
    price: 15_000,
    wiki: "https://dayz.fandom.com/wiki/M3S",
    variants: [v("Truck_01_Chassis", "Default", "Truck_01_Chassis.png")],
  },
  {
    id: "m3s-cargo",
    name: "M3S Cargo",
    role: "Open cargo bed",
    price: 18_000,
    wiki: "https://dayz.fandom.com/wiki/M3S",
    variants: [v("Truck_01_Cargo", "Default", "Truck_01_Cargo.png")],
  },
  {
    id: "humvee",
    name: "M1025 Humvee",
    role: "Armored recon",
    price: 80_000,
    wiki: "https://dayz.fandom.com/wiki/M1025",
    variants: [v("Offroad_02", "Military", "Offroad_02.png")],
  },
  {
    id: "boat",
    name: "Rubber Boat",
    role: "Water transport",
    price: 12_000,
    wiki: "https://dayz.fandom.com/wiki/Rubber_Boat",
    variants: [
      v("Boat_01_Blue", "Blue", "Boat_01_Blue.png"),
      v("Boat_01_Orange", "Orange", "Boat_01_Orange.png"),
      v("Boat_01_Black", "Black", "Boat_01_Black.png"),
      v("Boat_01_Camo", "Camo", "Boat_01_Camo.png"),
    ],
  },
];
