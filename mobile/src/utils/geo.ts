import { distance } from '@turf/distance';
import { along } from '@turf/along';
import { length } from '@turf/length';
import { lineString } from '@turf/helpers';
import type { Coordinate } from '../types/location';

export function validateCoordinate(coordinate: Coordinate) {
  if (
    !Number.isFinite(coordinate.latitude) ||
    Math.abs(coordinate.latitude) > 90
  ) {
    throw new Error('Latitude must be between -90 and 90.');
  }
  if (
    !Number.isFinite(coordinate.longitude) ||
    Math.abs(coordinate.longitude) > 180
  ) {
    throw new Error('Longitude must be between -180 and 180.');
  }
}

export function position(coordinate: Coordinate): [number, number] {
  return [coordinate.longitude, coordinate.latitude];
}

/** Converts a map [longitude, latitude] pair into a valid coordinate, wrapping longitude. */
export function fromPosition([longitude, latitude]:
  | [number, number]
  | number[]): Coordinate {
  const wrapped =
    longitude >= -180 && longitude <= 180
      ? longitude
      : ((((longitude + 180) % 360) + 360) % 360) - 180;
  return {
    latitude: Math.max(-90, Math.min(90, latitude)),
    longitude: wrapped,
  };
}

export function normalizeBearing(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

export function formatCoordinate(coordinate: Coordinate, digits = 6) {
  return `${coordinate.latitude.toFixed(
    digits,
  )}, ${coordinate.longitude.toFixed(digits)}`;
}

export function formatDistance(meters: number) {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`
    : `${Math.round(meters)} m`;
}

export function routeLengthMeters(points: Coordinate[], loop = false) {
  const path = loop && points.length > 1 ? [...points, points[0]] : points;
  return path
    .slice(1)
    .reduce(
      (meters, point, index) => meters + distanceMeters(path[index], point),
      0,
    );
}

export function distanceMeters(origin: Coordinate, destination: Coordinate) {
  validateCoordinate(origin);
  validateCoordinate(destination);
  return distance(position(origin), position(destination), { units: 'meters' });
}

export function insideRadius(
  distanceValue: number,
  radius: number,
  inclusive = false,
) {
  if (!Number.isFinite(radius) || radius <= 0 || radius > 100000) {
    throw new Error('Radius must be greater than 0 and at most 100000 meters.');
  }
  if (!Number.isFinite(distanceValue) || distanceValue < 0) {
    throw new Error('Distance must be finite and nonnegative.');
  }
  return inclusive ? distanceValue <= radius : distanceValue < radius;
}

export function interpolateRoute(
  points: Coordinate[],
  meters: number,
): Coordinate {
  if (points.length < 2) {
    throw new Error('A route needs at least two waypoints.');
  }
  points.forEach(validateCoordinate);
  if (!Number.isFinite(meters) || meters < 0) {
    throw new Error('Route distance must be nonnegative.');
  }
  const line = lineString(points.map(position));
  const result = along(
    line,
    Math.min(meters, length(line, { units: 'meters' })),
    { units: 'meters' },
  );
  return {
    latitude: result.geometry.coordinates[1],
    longitude: result.geometry.coordinates[0],
  };
}
