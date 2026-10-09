import i18n from "../i18n/i18n";
import { UZBEKISTAN_REGIONS } from "../data/uzbekistanRegions";

// Every place has a Russian and an Uzbek name; show the one matching the
// interface language (Uzbek unless the user switched to Russian).
export function placeName(place: { name: string; nameUz: string }): string {
  return i18n.language === "ru" ? place.name : place.nameUz;
}

export function regionName(code: string | null): string {
  if (!code) return "—";
  const region = UZBEKISTAN_REGIONS.find((r) => r.code === code);
  return region ? placeName(region) : code;
}

export function districtName(regionCode: string | null, districtCode: string | null): string {
  if (!regionCode || !districtCode) return "—";
  const district = UZBEKISTAN_REGIONS.find((r) => r.code === regionCode)?.districts.find((d) => d.code === districtCode);
  return district ? placeName(district) : districtCode;
}
