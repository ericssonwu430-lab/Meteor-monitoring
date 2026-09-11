import type {
  CadResponse,
  CloseApproach,
  Fireball,
  FireballResponse,
  SentryDetailResponse,
  SentryListResponse,
} from "@/types/neo";

const SENTRY_URL = "https://ssd-api.jpl.nasa.gov/sentry.api";
const CAD_URL = "https://ssd-api.jpl.nasa.gov/cad.api";
const FIREBALL_URL = "https://ssd-api.jpl.nasa.gov/fireball.api";

async function jplFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 90 },
  });
  if (!res.ok) {
    throw new Error(`JPL API ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchSentryList(): Promise<SentryListResponse> {
  return jplFetch<SentryListResponse>(SENTRY_URL);
}

export async function fetchSentryObject(
  des: string
): Promise<SentryDetailResponse> {
  const q = encodeURIComponent(des);
  return jplFetch<SentryDetailResponse>(`${SENTRY_URL}?des=${q}`);
}

export async function fetchCad(): Promise<CadResponse> {
  const params = new URLSearchParams({
    body: "Earth",
    neo: "true",
    "date-min": "now",
    "date-max": "+60",
    "dist-max": "0.05",
    sort: "date",
  });
  return jplFetch<CadResponse>(`${CAD_URL}?${params}`);
}

export async function fetchFireballs(
  limit = 50
): Promise<FireballResponse> {
  return jplFetch<FireballResponse>(
    `${FIREBALL_URL}?limit=${limit}`
  );
}

export function parseCadRows(res: CadResponse): CloseApproach[] {
  const idx = Object.fromEntries(res.fields.map((f, i) => [f, i]));
  return res.data.map((row) => ({
    des: row[idx.des] ?? "",
    orbit_id: row[idx.orbit_id] ?? "",
    jd: row[idx.jd] ?? "",
    cd: row[idx.cd] ?? "",
    dist: row[idx.dist] ?? "",
    dist_min: row[idx.dist_min] ?? "",
    dist_max: row[idx.dist_max] ?? "",
    v_rel: row[idx.v_rel] ?? "",
    v_inf: row[idx.v_inf] ?? "",
    t_sigma_f: row[idx.t_sigma_f] ?? "",
    h: row[idx.h] ?? "",
  }));
}

export function parseFireballRows(res: FireballResponse): Fireball[] {
  const idx = Object.fromEntries(res.fields.map((f, i) => [f, i]));
  return res.data.map((row) => {
    const latStr = row[idx.lat];
    const lonStr = row[idx.lon];
    const latDir = row[idx["lat-dir"]];
    const lonDir = row[idx["lon-dir"]];
    let lat: number | null = null;
    let lon: number | null = null;
    if (latStr != null && latStr !== "") {
      lat = parseFloat(latStr);
      if (latDir === "S") lat = -lat;
    }
    if (lonStr != null && lonStr !== "") {
      lon = parseFloat(lonStr);
      if (lonDir === "W") lon = -lon;
    }
    return {
      date: String(row[idx.date] ?? ""),
      energy: row[idx.energy] != null ? String(row[idx.energy]) : null,
      impact_e:
        row[idx["impact-e"]] != null ? String(row[idx["impact-e"]]) : null,
      lat,
      lon,
      alt: row[idx.alt] != null ? String(row[idx.alt]) : null,
      vel: row[idx.vel] != null ? String(row[idx.vel]) : null,
    };
  });
}
