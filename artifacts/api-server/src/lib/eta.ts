export type Pt = { lat: number; lng: number };
export type Ping = Pt & { at: Date };
export type Eta =
  | { state: "arrived" }
  | { state: "estimating"; meters: number; minutes: number; speedKmh: number; basis: "measured" | "default" };

export const ARRIVED_M = 75;    // within 75 m of home = arrived
const ROAD_FACTOR = 1.3; // straight line underestimates road distance
const DEFAULT_KMH = 20;  // used when speed can't be measured
const MIN_KMH = 3;
const MAX_KMH = 60;

export function meters(a: Pt, b: Pt): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// pings must be newest first
export function estimateEta(pings: Ping[], home: Pt): Eta | null {
  const latest = pings[0];
  if (!latest) return null;
  const left = meters(latest, home);
  if (left <= ARRIVED_M) return { state: "arrived" };

  const recent = pings
    .filter((p) => latest.at.getTime() - p.at.getTime() <= 10 * 60 * 1000)
    .slice(0, 5);
  const oldest = recent[recent.length - 1];
  let kmh = DEFAULT_KMH;
  let basis: "measured" | "default" = "default";
  if (oldest && oldest !== latest) {
    const secs = (latest.at.getTime() - oldest.at.getTime()) / 1000;
    if (secs >= 30) {
      const measured = (meters(oldest, latest) / secs) * 3.6;
      if (measured >= MIN_KMH) {
        kmh = Math.min(measured, MAX_KMH);
        basis = "measured";
      }
    }
  }
  const road = left * ROAD_FACTOR;
  return {
    state: "estimating",
    meters: Math.round(road),
    minutes: Math.max(1, Math.round((road / 1000 / kmh) * 60)),
    speedKmh: Math.round(kmh),
    basis,
  };
}