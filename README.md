# Meteor Monitoring — NEO Impact Dashboard (MVP)

Next.js App Router + TypeScript + Tailwind dashboard for NASA/JPL near-Earth object impact monitoring.

## Run

```bash
cd /workspace/Meteor-monitoring
npm install   # if needed
npm run dev   # http://localhost:3000
npm run build && npm start
```

## Features

- **Sentry risk list** ranked by impact probability (`ip`)
- **3D Earth globe** with selectable shooting-star trails and full trajectory ribbons
- **Scrubbable trajectory timeline** (play/pause) shared with Earth and solar views
- **Continuous zoom** from near-Earth trails to heliocentric SBDB orbits
- **Play → camera follow + auto-zoom** on the primary meteor (drag overrides; Play resumes)
- **Timeline dates** in `dd/mm/yyyy` from Sentry/SBDB (no geographic impact country for Sentry NEOs — NASA does not publish that)
- **Origin + brief details** (orbit class, elements, observation arc) from SBDB + Sentry
- **Live sky position** on Details + globe HUD from JPL Horizons (geocentric RA/Dec, distance, V mag; approximate constellation). The trajectory time bar spans first observation → potential impact (Sentry/SBDB); Horizons minute samples apply only when the scrubbed UTC falls inside the loaded −6h…+18h window.
- Object detail page with virtual-impactor table
- Close approaches (CAD, next 60 days, ≤ 0.05 AU)
- Recent fireballs on a simple SVG world map
- Auto-refresh every 120s · min-IP filters · dark space theme
- Mobile-friendly stack, tabbed panels, single timeline under the globe, ≥44px targets

## Impact %

**Impact % = Sentry `ip × 100`.**  
Very small probabilities use scientific notation (see `src/lib/format.ts`).

**Origin** in the focused-meteor panel means dynamical orbit class and Keplerian elements from public JPL SBDB — not a physical birthplace.

## Data freshness

The dashboard shows **Data as of &lt;time&gt;** next to the header and above the globe. Lists auto-refresh **every 2 minutes** from NASA/JPL. SBDB orbits are fetched per selected object (cached ~5 minutes). Live sky position + optional minute series for the focused meteor come from JPL Horizons (cached ~90s). The scrubbable time bar uses Sentry/SBDB first-obs → impact bounds; only the meteor heliocentric orbit follows the scrubbed date via SBDB Kepler elements + epoch (educational); planet bodies are fixed markers without orbit rings; Horizons series is sampled only inside its short window. Estimates can change when new observations arrive.

## Data sources

Proxied via Next.js route handlers (`revalidate` ~90–300s):

| Route | Upstream |
|-------|----------|
| `/api/sentry` | https://ssd-api.jpl.nasa.gov/sentry.api |
| `/api/sentry/[des]` | `sentry.api?des=` |
| `/api/cad` | `cad.api?body=Earth&neo=true&date-min=now&date-max=+60&dist-max=0.05&sort=date` |
| `/api/fireballs` | `fireball.api?limit=50` |
| `/api/sbdb/[des]` | `sbdb.api?sstr=` |
| `/api/geocode` | OpenStreetMap Nominatim reverse (fireball lat/lon only; cached) |
| `/api/ephemeris/[des]` | JPL Horizons observer table (`CENTER=500@399`, RA/Dec/V/delta + minute `series` over −6h…+18h; ~90s cache) |

Attribution: **NASA/JPL Solar System Dynamics** APIs. This app is for education/monitoring — not official emergency alerting.

## Phone vs desktop

- **Desktop:** meteor list + origin details sit beside the globe; timeline is under the canvas. Drag to orbit, scroll to zoom, Play/Pause or scrub the ribbon.
- **Phone:** sections stack. Collapse the list for a larger globe. Timeline is sticky at the bottom with large play/scrub controls. Drag/pinch the globe without scrolling the page. Safe-area padding for notched devices.

## Disclaimer

Most Sentry objects have tiny cumulative probabilities over decades. A large displayed % often belongs to a very small asteroid.

## Privacy

- No user accounts, identity cookies, or analytics in this app.
- No collection of names, emails, or browser geolocation.
- Client calls only this app’s `/api/*` routes; NASA/JPL and reverse-geocode run on the server.
- Fireball “Spotted near” geocode uses NASA CNEOS fireball lat/lon only (never the visitor’s location). Sentry NEOs have no scientific impact-country field in this app.
- Hosting platforms may retain standard access logs (IP, user-agent) per their policies.
