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
}
