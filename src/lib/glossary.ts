/** Short plain-English tips for dashboard labels (shown next to (i) icons). */
export const TIPS = {
  impactProbability:
    "Chance this object could hit Earth over the years NASA lists — from Sentry, not a weather forecast.",
  torino:
    "0–10 public scale for impact risk. 0 = no hazard; higher means more concern (almost all objects stay at 0).",
  palermo:
    "Log scale comparing this risk to the average background risk from space rocks. Negative is typical and low.",
  diameter:
    "Estimated size of the object (kilometers). Often uncertain for small NEOs.",
  absoluteMagnitude:
    "Absolute magnitude H — how bright the object would look at a standard distance. Lower H usually means larger.",
  viYears:
    "Year range when Sentry finds possible “virtual impactor” dates (possible hit windows in the model).",
  virtualImpactors:
    "Count of possible impact solutions in Sentry’s model — not confirmed hits.",
  lastObs:
    "Date of the most recent observation used in the orbit. Fresher data usually means a better orbit.",
  firstObs:
    "Date of the earliest observation used in the orbit. Together with Last obs it defines the observation arc.",
  vInf:
    "Speed relative to Earth if it arrived from infinity (km/s) — how fast it would approach.",
  vImp:
    "Impact speed at Earth (km/s) — how fast it would hit if it reached the surface.",
  mass:
    "Estimated mass of the object in kilograms. Often derived from size and assumed density.",
  observations:
    "Number of observations (nobs) used to fit the orbit.",
  method:
    "Orbit determination method used by Sentry (for example IOBS).",
  dataArc:
    "Length of the observation arc (days from first to last observation). Longer arcs usually mean a better-known orbit.",
  sigmaVi:
    "Sentry: how many sigma the virtual-impactor solution is from the nominal orbit — larger means farther from the best-fit path.",
  impactEnergy:
    "Estimated impact energy in megatons of TNT equivalent.",
  originOrbit:
    "Dynamical orbit class from JPL SBDB (how it moves around the Sun) — not a physical birthplace on a map.",
  minImpactProb:
    "Hide objects whose cumulative impact probability is below this threshold.",
  dataAsOf:
    "When this browser last successfully fetched NASA/JPL feeds. Auto-refresh runs about every 2 minutes.",
  meteorsList:
    "Sentry risk objects you can plot on the globe. Sorted newest discovery first.",
  newBadge:
    "Appeared in the Sentry list after a later refresh on this device. Badge stays about 24 hours.",
  trajectory:
    "Scrub or play from first observation to potential impact (Sentry/SBDB). Live sky HUD is separate JPL Horizons geocentric now — minute samples apply only if the scrubbed UTC falls inside the loaded Horizons window. Near Earth you see atmospheric approach; zoom out for the heliocentric orbit.",
  fireballs:
    "Bright meteors that already entered Earth’s atmosphere (past events from US sensors) — not the same as future Sentry risks.",
  fireballSpotted:
    "Country or ocean region where NASA/US sensors recorded the fireball (from the event’s lat/lon). Over water this is a basin like North Pacific Ocean. This is the meteor’s location — never your GPS or IP.",
  closeApproach:
    "Predicted near-miss distance and time from NASA’s Close Approach database.",
  earthView:
    "Close-up 3D Earth with approach trails and impact %. Scroll out for the solar system.",
  solarView:
    "Sun-centered view with planets and the object’s orbit around the Sun.",
  designation:
    "Official or provisional name/ID used by NASA/JPL for this near-Earth object.",
  moid:
    "Minimum orbit intersection distance with Earth — how close the paths can get in AU.",
  semiMajor:
    "Average orbital size (AU). 1 AU ≈ Earth–Sun distance.",
  eccentricity:
    "How stretched the ellipse is. 0 = circle; closer to 1 = very elongated.",
  inclination:
    "Tilt of the orbit relative to Earth’s orbital plane (degrees).",
  eventsFeed:
    "Recent fireballs and upcoming close approaches mixed into one chronological list.",
  riskCards:
    "Summary cards ranked in the current list order (newest discovery first when unfiltered by IP).",
  focusedMeteor:
    "The meteor currently highlighted for details and camera follow.",
  neoMonitor:
    "Live near-Earth object risk dashboard fed by public NASA/JPL sources.",
  liveSky:
    "Where the object is in Earth's sky right now from JPL Horizons — geocentric apparent RA/Dec, distance (km + AU), light-travel time, and V magnitude. Alt/Az needs an observer site, so we show Earth-centered Horizons like JPL instead of visitor GPS. Not a predicted impact site or country.",
  horizons:
    "NASA/JPL Horizons computes precise positions of solar-system bodies. This app requests an Earth-centered (geocentric) observer table (CENTER=500@399). Alt/Az would need your location — we never ask for it.",
  distanceAu:
    "Geocentric range in astronomical units (Horizons delta). 1 AU ≈ 149,597,870.7 km.",
  lightTravel:
    "How long light takes to travel the current geocentric range (distance / speed of light).",
  apparentCoords:
    "Apparent right ascension and declination as seen from Earth's center (light-time included). These are sky coordinates, not a ground track or impact country.",
  constellation:
    "Approximate IAU constellation from the apparent RA/Dec (Roman 1987 boundaries at B1875, precessed from J2000). A sky region — not a place on Earth.",
  apparentMagnitude:
    "Approximate apparent visual magnitude from Horizons (IAU H-G). Larger numbers are fainter.",
  geocentricDistance:
    "Current range from Earth's center to the object (Horizons delta), converted from AU to kilometers.",
} as const;
