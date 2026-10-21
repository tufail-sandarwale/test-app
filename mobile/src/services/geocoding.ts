import type { Coordinate } from '../types/location';

export interface Place extends Coordinate {
  id: string;
  name: string;
  address: string;
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
// Nominatim's usage policy requires an identifying User-Agent and at most 1 request per second.
const USER_AGENT = 'MockGPSTester/1.0 (React Native Android GPS testing app)';
export const MIN_SEARCH_INTERVAL_MS = 1100;
const TIMEOUT_MS = 10000;

let lastRequestAt = 0;

export function resetSearchThrottle() {
  lastRequestAt = 0;
}

/** Parses "lat, lng", "lat lng" or "lat;lng" decimal degrees. */
export function parseCoordinates(text: string): Coordinate | null {
  const match = text
    .trim()
    .match(/^([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

const wait = (milliseconds: number) =>
  new Promise<void>(resolve => setTimeout(resolve, milliseconds));

interface NominatimResult {
  place_id?: number | string;
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const text = query.trim();
  if (!text) {
    return [];
  }
  if (text.length > 200) {
    throw new Error('Search text must be 200 characters or fewer.');
  }
  const delay = lastRequestAt + MIN_SEARCH_INTERVAL_MS - Date.now();
  if (delay > 0) {
    await wait(delay);
  }
  lastRequestAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(
      `${ENDPOINT}?format=jsonv2&limit=8&q=${encodeURIComponent(text)}`,
      {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: controller.signal,
      },
    );
  } catch {
    throw new Error(
      'Search is unavailable. Check your connection, or type coordinates as latitude, longitude.',
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? 'Too many searches. Wait a moment and try again.'
        : `Search failed (HTTP ${response.status}).`,
    );
  }
  const body: unknown = await response.json();
  if (!Array.isArray(body)) {
    throw new Error('Search returned an unexpected response.');
  }
  return (body as NominatimResult[]).flatMap((item, index) => {
    const latitude = Number(item.lat);
    const longitude = Number(item.lon);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return [];
    }
    const address = String(item.display_name ?? '');
    const name = String(item.name || address.split(',')[0] || 'Unnamed place');
    return [
      {
        id: String(item.place_id ?? index),
        name,
        address,
        latitude,
        longitude,
      },
    ];
  });
}
