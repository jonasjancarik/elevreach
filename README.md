# ElevReach

Interactive terrain map for any city with a discoverable administrative boundary.

Default city: Prague. Search another city, then click any point and highlight:

- cells within the same elevation band
- cells that stay under an elevation ceiling
- or cells reachable within a cumulative uphill budget on the least-ascent terrain path
- with cumulative ascent available as either one-way or back-and-forth budget

Use case: show that many trips in a city are topographically easier than the city's reputation suggests.

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
- On click, the app computes either:
  - a symmetric elevation band around the anchor point
  - an elevation ceiling mask with limited allowed rise and unlimited drop
  - or the least-ascent terrain reach under a cumulative climb budget, either one-way or round-trip
- Optional connectivity filter keeps only the contiguous region touching the anchor for non-path modes

## Limits

- terrain only; no road network, bridges, or route costs yet
- DEM sampling is coarse enough for city-scale storytelling, not engineering use
- ceiling mode is an elevation lens, not a promise of an easy ride
- cumulative ascent mode uses terrain-grid paths, so flat detours are still cheaper than they would be on real streets
- round-trip ascent mode adds best uphill cost there and best uphill cost back; those terrain paths may differ

## Next useful step

Snap the cumulative-ascent mode onto a real street / bike graph, then price edges by uphill meters plus route penalties.

## GitHub Pages

Deploys automatically from GitHub Actions on pushes to `main`.
