import type {
  Coordinate,
  LocationConfig,
  SimulationSettings,
} from '../types/location';
import { distanceMeters, validateCoordinate } from './geo';

export function numberValue(value: string, label: string) {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return parsed;
}

export function bounded(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
}

export function validateLocation(location: LocationConfig) {
  validateCoordinate(location);
  bounded(location.accuracy, 0.1, 10000, 'Accuracy');
  bounded(location.altitude, -12000, 100000, 'Altitude');
  bounded(location.bearing, 0, 359.999, 'Bearing');
  bounded(location.speed, 0, 300, 'Speed (m/s)');
}

export function validateSettings(settings: SimulationSettings) {
  validateLocation({
    latitude: 0,
    longitude: 0,
    ...settings,
    speed: settings.speedKmh / 3.6,
  });
  bounded(settings.updateIntervalMs, 200, 10000, 'Update interval (ms)');
  if (!Number.isInteger(settings.updateIntervalMs)) {
    throw new Error('Update interval must be whole milliseconds.');
  }
  bounded(settings.radiusMeters, 0.1, 100000, 'Radius (m)');
  bounded(settings.durationSeconds, 0, 86400, 'Duration (seconds)');
  if (!['once', 'loop'].includes(settings.routeMode)) {
    throw new Error('Invalid route mode.');
  }
  if (typeof settings.includeBoundary !== 'boolean') {
    throw new Error('Invalid boundary setting.');
  }
}

export function validateRoute(points: Coordinate[], speedKmh: number) {
  if (!Array.isArray(points) || points.length < 2 || points.length > 500) {
    throw new Error('A route requires 2 to 500 waypoints.');
  }
  points.forEach(validateCoordinate);
  bounded(speedKmh, 0.001, 1080, 'Route speed (km/h)');
  const length = points
    .slice(1)
    .reduce(
      (meters, point, index) => meters + distanceMeters(points[index], point),
      0,
    );
  if (length <= 0.01) {
    throw new Error('A route requires distinct waypoints.');
  }
}

export function validName(name: string) {
  if (!name.trim() || name.trim().length > 80) {
    throw new Error('Name must contain 1 to 80 characters.');
  }
  return name.trim();
}
