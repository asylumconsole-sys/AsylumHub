export const FACTION_FLAGS = [
  ["dayz", "DayZ", "Flag_DayZ.png"],
  ["white", "White", "Flag_White.png"],
  ["bohemia", "Bohemia Interactive", "Flag_Bohemia.png"],
  ["pirates", "Pirates", "Flag_Pirates.png"],
  ["cannibals", "Cannibals", "Flag_Cannibals.png"],
  ["baby-deer", "Baby Deer", "Flag_BabyDeer.png"],
  ["refuge", "Refuge", "Flag_Refuge.png"],
  ["rsta", "RSTA", "Flag_RSTA.png"],
  ["snake", "Snake", "Flag_Snake.png"],
  ["cdf", "Chernarussian Defence Forces", "Flag_CDF.png"],
  ["chel", "CHEL", "Flag_CHEL.png"],
  ["cmc", "Chernarus Mining Corporation", "Flag_CMC.png"],
  ["chedaki", "Chernarussian Movement of the Red Star", "Flag_Chedaki.png"],
  ["chernarus", "Republic of Chernarus", "Flag_Chernarus.png"],
  ["hunterz", "Zombie Hunters", "Flag_HunterZ.png"],
  ["napa", "National Party (NAPA)", "Flag_NAPA.png"],
  ["rooster", "Rooster", "Flag_Rooster.png"],
  ["tec", "TEC", "Flag_TEC.png"],
  ["uec", "United Earth Coalition", "Flag_UEC.png"],
  ["wolf", "Wolf", "Flag_Wolf.png"],
  ["zenit", "Zenit Radio Station", "Flag_Zenit.png"],
  ["apa", "Asian Pacific Alliance", "Flag_APA.png"],
  ["altis", "Republic of Altis and Stratis", "Flag_Altis.png"],
  ["bear", "Bear", "Flag_Bear.png"],
  ["brainz", "BrainZ", "Flag_BrainZ.png"],
  ["crook", "Crook", "Flag_Crook.png"],
  ["livonia", "Livonia", "Flag_Livonia.png"],
  ["ldf", "Livonian Defense Force", "Flag_LivoniaArmy.png"],
  ["livonia-police", "Livonia Police", "Flag_LivoniaPolice.png"],
  ["north-sahrani", "Democratic Republic of Sahrani", "Flag_NSahrani.png"],
  ["rex", "Rex", "Flag_Rex.png"],
  ["south-sahrani", "Kingdom of Sahrani", "Flag_SSahrani.png"],
  ["zagorky", "Zagorky", "Flag_Zagorky.png"],
  ["sakhal", "Sakhal", "Sakhal_flag.PNG"],
] as const;

export type FactionFlagId = (typeof FACTION_FLAGS)[number][0];

export function flagImage(file: string) {
  return `https://dayz.wiki.gg/wiki/Special:FilePath/${encodeURIComponent(file)}`;
}

export function flagImageFallback(file: string) {
  return `https://dayz.fandom.com/wiki/Special:FilePath/${encodeURIComponent(file)}`;
}
