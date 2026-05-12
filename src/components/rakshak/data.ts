import locationsRaw from "@/data/locations.json";
import statusMetaRaw from "@/data/statusMeta.json";
import riskMetaRaw from "@/data/riskMeta.json";
import progressStepsRaw from "@/data/progressSteps.json";
import authCategoriesRaw from "@/data/authCategories.json";
import stateBoundsRaw from "@/data/stateBounds.json";
import geoNameMapRaw from "@/data/geoNameMap.json";
import siteMapsRaw from "@/data/siteMaps.json";
import universitiesRaw from "@/data/universities.json";
import type { Location, Risk, StatusMeta, StatusKey } from "./types";

export const LOC = locationsRaw as Location[];
export const ST = statusMetaRaw as Record<StatusKey, StatusMeta>;
export const RC = (riskMetaRaw as { RC: Record<Risk, string>; RL: Record<Risk, string> }).RC;
export const RL = (riskMetaRaw as { RC: Record<Risk, string>; RL: Record<Risk, string> }).RL;
export const PROG = progressStepsRaw as { k: StatusKey; l: string }[];
export const AUTH_CATS = authCategoriesRaw as { k: string; l: string; d: string }[];
export const SB = stateBoundsRaw as Record<string, [[number, number], [number, number]]>;
export const GEO_NAME_MAP = geoNameMapRaw as Record<string, string>;
export const SITE_MAPS = siteMapsRaw as Record<string, string>;
export const UNIS = universitiesRaw as { name: string; file?: string }[];

// Eagerly resolve university logo image URLs via Vite glob
const uniAssets = import.meta.glob("@/assets/universities/*.{png,jpg,jpeg,svg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export function uniLogoUrl(file: string): string | undefined {
  // The keys look like "/src/assets/universities/01_iit_delhi.png"
  const found = Object.entries(uniAssets).find(([k]) => k.endsWith("/" + file));
  return found?.[1];
}

export function getSiteMapUrl(id: number): string | null {
  const fid = SITE_MAPS[String(id)];
  if (!fid) return null;
  return `https://drive.google.com/thumbnail?id=${fid}&sz=w800`;
}

export function getAuthShort(authStr: string | undefined): string {
  if (!authStr) return "Authority";
  if (authStr.includes("NHAI")) return "NHAI";
  const m = authStr.match(/\(([A-Z]{2,6})\)/);
  if (m) return m[1];
  const s = authStr.split(",")[0].split("(")[0].trim();
  return s.length > 24 ? s.substring(0, 24) + "…" : s;
}
