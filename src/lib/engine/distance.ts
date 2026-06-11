/** Great-circle distance in meters between two lat/lng points. */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Walking minutes at ~80 m/min (a relaxed city pace). */
export function walkMinutes(meters: number): number {
  return meters / 80;
}

/** Initial compass bearing (degrees, 0 = North) from A to B. */
export function bearing(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const dLng = toRad(bLng - aLng === 0 ? 0 : bLng - aLng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function formatWalk(meters: number): string {
  const min = Math.round(walkMinutes(meters));
  if (min < 1) return "<1 min walk";
  return `${min} min walk`;
}

export function formatDistance(meters: number): string {
  if (meters < 160) return `${Math.round(meters)} m`;
  const miles = meters / 1609.34;
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}
