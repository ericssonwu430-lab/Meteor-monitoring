/** NASA/JPL Sentry risk list entry */
export interface RiskEvent {
  id: string;
  des: string;
  fullname: string;
  ip: string;
  ps_cum: string;
  ps_max: string;
  ts_max: string | null;
  diameter: string | null;
  h: string;
  n_imp: number;
  range: string;
  last_obs: string;
  last_obs_jd: string;
  v_inf: string;
}

export interface SentryListResponse {
  signature: { source: string; version: string };
  count: string;
  data: RiskEvent[];
}

/** Virtual impactor row from sentry.api?des= */
export interface VirtualImpactor {
  date: string;
  energy: string;
  ip: string;
  ps: string;
  ts: string | null;
  sigma_vi: string;
}

export interface SentryObjectSummary {
  des: string;
  fullname: string;
  ip: string;
  ps_cum: string;
  ps_max: string;
  ts_max: string | null;
  diameter: string | null;
  h: string;
  n_imp: number;
  energy?: string;
  mass?: string;
  v_imp?: string;
  v_inf?: string;
  first_obs?: string;
  last_obs?: string;
  nobs?: number;
  method?: string;
  pdate?: string;
  cdate?: string;
  darc?: string;
  ndel?: number;
  ndop?: number;
  nsat?: string;
}

export interface SentryDetailResponse {
  signature: { source: string; version: string };
  summary: SentryObjectSummary;
  data: VirtualImpactor[];
}

/** CAD API — fields + rows */
export type CadField =
  | "des"
  | "orbit_id"
  | "jd"
  | "cd"
  | "dist"
  | "dist_min"
  | "dist_max"
  | "v_rel"
  | "v_inf"
  | "t_sigma_f"
  | "h";

export interface CadResponse {
  signature: { source: string; version: string };
  count: number;
  fields: CadField[];
  data: string[][];
}

export interface CloseApproach {
  des: string;
  orbit_id: string;
  jd: string;
  cd: string;
  dist: string;
  dist_min: string;
  dist_max: string;
  v_rel: string;
  v_inf: string;
  t_sigma_f: string;
  h: string;
}

export type FireballField =
  | "date"
  | "energy"
  | "impact-e"
  | "lat"
  | "lat-dir"
  | "lon"
  | "lon-dir"
  | "alt"
  | "vel";

export interface FireballResponse {
  signature: { source: string; version: string };
  count: string;
  fields: FireballField[];
  data: (string | null)[][];
}

export interface Fireball {
  date: string;
  energy: string | null;
  impact_e: string | null;
  lat: number | null;
  lon: number | null;
  alt: string | null;
  vel: string | null;
  /** Reverse-geocoded country of the event coords — never visitor location. */
  country?: string | null;
  /** Country or ocean/region label where the fireball was spotted. */
  location?: string | null;
  /** Same as location (readable spotted place). */
  spotted?: string | null;
}

/** JPL SBDB orbit element row */
export interface SbdbElement {
  name: string;
  value: string;
  sigma?: string | null;
  units?: string | null;
  title?: string;
  label?: string;
}

export interface SbdbOrbitClass {
  code: string;
  name: string;
}

export interface SbdbObject {
  des: string;
  fullname?: string;
  spkid?: string;
  neo?: boolean;
  pha?: boolean;
  orbit_class?: SbdbOrbitClass;
  kind?: string;
}

export interface SbdbOrbit {
  epoch?: string;
  first_obs?: string;
  last_obs?: string;
  data_arc?: string;
  n_obs_used?: number;
  moid?: string;
  condition_code?: string;
  elements?: SbdbElement[];
}

export interface SbdbResponse {
  signature?: { source: string; version: string };
  object?: SbdbObject;
  orbit?: SbdbOrbit;
  phys_par?: unknown[];
  code?: string;
  message?: string;
}

/** Normalized orbital elements for UI / Keplerian viz */
export interface OrbitElements {
  a: number | null;
  e: number | null;
  i: number | null;
  om: number | null;
  w: number | null;
  ma: number | null;
  q: number | null;
  ad: number | null;
  orbitClass: string | null;
  orbitClassCode: string | null;
  designation: string | null;
  fullname: string | null;
  firstObs: string | null;
  lastObs: string | null;
  dataArc: string | null;
  moid: string | null;
  available: boolean;
  error?: string;
}

/** Live geocentric observer ephemeris from JPL Horizons */
export interface HorizonsEphemeris {
  des: string;
  name: string;
  constellation: string;
  constellationAbbr?: string;
  distanceKm: number;
  /** Geocentric range in AU (Horizons delta). */
  deltaAu: number;
  /** Light-travel time from object to Earth center (distanceKm / c). */
  lightTravelSeconds: number;
  ra: string;
  dec: string;
  raHours?: number;
  decDeg?: number;
  magnitude: number | null;
  asOf: string;
  source: "JPL Horizons";
  error?: string;
}
