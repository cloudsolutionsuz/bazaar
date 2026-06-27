import { UZBEKISTAN_REGIONS } from "../data/uzbekistanRegions";

export function regionName(code: string | null): string {
  if (!code) return "—";
  return UZBEKISTAN_REGIONS.find((r) => r.code === code)?.name ?? code;
}

export function districtName(regionCode: string | null, districtCode: string | null): string {
  if (!regionCode || !districtCode) return "—";
  const region = UZBEKISTAN_REGIONS.find((r) => r.code === regionCode);
  return region?.districts.find((d) => d.code === districtCode)?.name ?? districtCode;
}
