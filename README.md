# ElevReach

Interactive terrain map for any city with a discoverable administrative boundary.

Default city: Prague. Search another city, then click any point and highlight:

- cells within the same elevation band
- cells that stay under an elevation ceiling
- or cells reachable within a cumulative uphill budget on the least-ascent terrain path
- or, in radius mode, streets reachable on an OSM street graph priced by distance, uphill, and steep ramps
- with cumulative ascent available as either one-way or back-and-forth budget
- plus a Prague-only estimate of residents living in the matched cells
- UI auto-detects English vs Czech from browser locale; header switcher can override

Use case: show that many trips in a city are lower-climb than the city's reputation suggests, without overselling that as a guaranteed easy ride.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## How it works

- Default Prague boundary bundled in `public/data/prague-boundary.geojson`
- Other city boundaries fetched from OpenStreetMap/Nominatim and cached in browser local storage
- Elevation sampled from public Terrarium DEM tiles at zoom 12
- Boundary rasterized into a city mask
- Prague currently adds one synthetic connector for Nuselsky most so terrain reach can cross the valley there
- On click, the app computes either:
  - a symmetric elevation band around the anchor point
  - an elevation ceiling mask with limited allowed rise and unlimited drop
  - or the least-ascent terrain reach under a cumulative climb budget, either one-way or round-trip
  - or, in radius mode, a street-network reach on routable OpenStreetMap ways under a climb-equivalent effort budget
- Optional connectivity filter keeps only the contiguous region touching the anchor for non-path modes
- Default UI shows trip radius plus round-trip climb budget; advanced controls reveal search area, route model, and alternate terrain lenses

## Cycling interpretation

- Best current cycling lens: cumulative climb budget, especially round-trip
- New beta: street graph mode in radius scope; prices distance, uphill, and steep ramps into climb-equivalent meters
- Safer product language: `low-climb`, `topographic ease`, `terrain-only`
- Unsafe product language: `easy ride`, `effortless`, `casual for everyone`
- Why: terrain mode still prices uphill only; street mode improves this but still misses traffic, surface, stairs, and junction stress
- Short product note: [docs/low-climb-cycling.md](docs/low-climb-cycling.md)

## Limits

- band, ceiling, and terrain climb mode are still terrain only; no road network or route cost there yet
- Prague has one hardcoded bridge exception for Nuselsky most; other bridges and viaducts are still ignored
- street graph beta is radius-scope only; city-scope still falls back to terrain reach
- DEM sampling is coarse enough for city-scale storytelling, not engineering use
- ceiling mode is an elevation lens, not a promise of an easy ride
- cumulative ascent mode uses terrain-grid paths, so flat detours are still cheaper than they would be on real streets
- cumulative ascent mode does not price route distance yet, so a long flat detour can still look cheap
- round-trip ascent mode adds best uphill cost there and best uphill cost back; those terrain paths may differ
- street graph beta depends on OpenStreetMap tags and Overpass availability; some starts may snap onto the nearest routable street
- street graph beta still does not price traffic stress, surfaces, lights, or turn friction
- resident estimate is Prague-only for now, derived from WorldPop 2020 population counts projected onto the bundled Prague terrain grid

## Next useful step

Broaden street mode beyond radius scope, cache graph fetches more aggressively, then add rider presets and extra costs for traffic stress, surface, and stairs.

## GitHub Pages

Deploys automatically from GitHub Actions on pushes to `main`.

## Regenerate Prague Population Layer

```bash
npm run build:prague-population
```

This downloads the Czech Republic WorldPop 2020 raster to `/tmp/worldpop-cze-2020.tif`, then projects it onto the bundled Prague terrain grid and writes:

- `public/data/prague-population-grid.json`
- `public/data/prague-population-grid.bin`
