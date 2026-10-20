export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface LocationConfig extends Coordinate {
  accuracy: number;
  altitude: number;
  bearing: number;
  speed: number;
}

export interface LocationPreset extends LocationConfig {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationSettings {
  updateIntervalMs: number;
  accuracy: number;
  altitude: number;
  bearing: number;
  speedKmh: number;
  radiusMeters: number;
  durationSeconds: number;
  routeMode: 'once' | 'loop';
  includeBoundary: boolean;
}

export interface RoutePreset {
  id: string;
  name: string;
  points: Coordinate[];
  speedKmh: number;
  createdAt: string;
  updatedAt: string;
}
