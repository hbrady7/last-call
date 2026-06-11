/**
 * The office. Everything anchors here by default — distances, the coverage
 * ring, the planner's start point. Coordinate verified via Nominatim
 * (the spec's estimate was ~130 m off the AMA Plaza building).
 */
export const HQ = {
  name: "330 N Wabash",
  lat: 41.8886592,
  lng: -87.627596,
} as const;

export const RADIUS_MILES = 2;
export const RADIUS_METERS = Math.round(RADIUS_MILES * 1609.34); // 3219
