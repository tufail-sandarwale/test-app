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
