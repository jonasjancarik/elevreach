const TILE_SIZE = 256;
const EARTH_CIRCUMFERENCE = 40_075_016.686;

export function lonToWorldX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * scale(zoom);
}

export function latToWorldY(lat: number, zoom: number) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const clamped = Math.min(Math.max(sinLat, -0.9999), 0.9999);

  return (
    (0.5 - Math.log((1 + clamped) / (1 - clamped)) / (4 * Math.PI)) *
    scale(zoom)
  );
}

export function worldXToLon(worldX: number, zoom: number) {
  return (worldX / scale(zoom)) * 360 - 180;
}

export function worldYToLat(worldY: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * worldY) / scale(zoom);
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

export function metersPerPixel(lat: number, zoom: number) {
  return (
    (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)) /
    scale(zoom)
  );
}

export function tileSize() {
  return TILE_SIZE;
}

function scale(zoom: number) {
  return TILE_SIZE * 2 ** zoom;
}
