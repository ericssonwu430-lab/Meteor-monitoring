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
- Object detail with virtual-impactor table
- Close approaches (CAD, next 60 days, ≤ 0.05 AU)
- Recent fireballs on a simple SVG world map
- Auto-refresh every 120s · min-IP filters · dark space theme

## Impact %

**Impact % = Sentry `ip × 100`.**  
Very small probabilities use scientific notation (see `src/lib/format.ts`).

## Data sources

Proxied via Next.js route handlers (`revalidate` ~90–120s):

| Route | Upstream |
|-------|----------|
| `/api/sentry` | https://ssd-api.jpl.nasa.gov/sentry.api |
| `/api/sentry/[des]` | `sentry.api?des=` |
| `/api/cad` | `cad.api?body=Earth&neo=true&date-min=now&date-max=+60&dist-max=0.05&sort=date` |
| `/api/fireballs` | `fireball.api?limit=50` |

Attribution: **NASA/JPL Solar System Dynamics** APIs. This app is for education/monitoring — not official emergency alerting.

## Disclaimer

Most Sentry objects have tiny cumulative probabilities over decades. A large displayed % often belongs to a very small asteroid.
