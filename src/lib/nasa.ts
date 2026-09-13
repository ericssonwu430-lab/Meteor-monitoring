import type {
  CadResponse,
  CloseApproach,
  Fireball,
  FireballResponse,
  OrbitElements,
  SbdbElement,
  SbdbResponse,
  SentryDetailResponse,
  SentryListResponse,
} from "@/types/neo";

const SENTRY_URL = "https://ssd-api.jpl.nasa.gov/sentry.api";
const CAD_URL = "https://ssd-api.jpl.nasa.gov/cad.api";
const FIREBALL_URL = "https://ssd-api.jpl.nasa.gov/fireball.api";
const SBDB_URL = "https://ssd-api.jpl.nasa.gov/sbdb.api";

async function jplFetch<T>(url: string, revalidate = 90): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate },
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

export async function fetchFireballs(limit = 50): Promise<FireballResponse> {
  return jplFetch<FireballResponse>(`${FIREBALL_URL}?limit=${limit}`);
}

export async function fetchSbdb(des: string): Promise<SbdbResponse> {
  const q = encodeURIComponent(des);
  return jplFetch<SbdbResponse>(
    `${SBDB_URL}?sstr=${q}&phys-par=true`,
    300
  );
}

function elemMap(elements: SbdbElement[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!elements) return out;
  for (const el of elements) {
    const n = parseFloat(el.value);
    if (Number.isFinite(n)) out[el.name] = n;
  }
  return out;
}

export function parseOrbitElements(res: SbdbResponse): OrbitElements {
  if (res.code || !res.object || !res.orbit) {
    return {
      a: null,
      e: null,
      i: null,
      om: null,
      w: null,
      ma: null,
      q: null,
      ad: null,
      orbitClass: null,
      orbitClassCode: null,
      designation: null,
      fullname: null,
      epoch: null,
      firstObs: null,
      lastObs: null,
      dataArc: null,
      moid: null,
      available: false,
      error: res.message || res.code || "SBDB data unavailable",
    };
  }
  const m = elemMap(res.orbit.elements);
  const hasCore = m.a != null && m.e != null;
  return {
    a: m.a ?? null,
    e: m.e ?? null,
    i: m.i ?? null,
    om: m.om ?? null,
    w: m.w ?? null,
    ma: m.ma ?? null,
    q: m.q ?? null,
    ad: m.ad ?? null,
    orbitClass: res.object.orbit_class?.name ?? null,
    orbitClassCode: res.object.orbit_class?.code ?? null,
    designation: res.object.des ?? null,
    fullname: res.object.fullname ?? null,
    epoch: res.orbit.epoch ?? null,
    firstObs: res.orbit.first_obs ?? null,
    lastObs: res.orbit.last_obs ?? null,
    dataArc: res.orbit.data_arc ?? null,
    moid: res.orbit.moid ?? null,
    available: hasCore,
    error: hasCore ? undefined : "Incomplete orbital elements from SBDB",
  };
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
