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
    "Scrub or play along the path. Near Earth you see atmospheric approach; zoom out for the heliocentric orbit.",
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
  potentialImpact:
    "Country or ocean under the animated near-Earth path endpoint on the globe. This endpoint is illustrative (seeded for visualization) — not an official NASA/Sentry ground track. Over water we show an ocean basin, not a guessed country. Country names are in English so you can search them in the meteor list.",
} as const;
