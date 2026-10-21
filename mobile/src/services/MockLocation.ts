import {
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import type { Coordinate, LocationConfig } from '../types/location';

export interface Prerequisites {
  permissionGranted: boolean;
  locationEnabled: boolean;
  mockAppSelected: boolean;
  developerOptionsEnabled: boolean;
  notificationsEnabled: boolean;
}

export type SystemSettingsScreen = 'about' | 'developer' | 'location' | 'app';

export interface LocationReading extends LocationConfig {
  timestamp: number;
  provider: string;
}

export interface SimulationStatus {
  state: 'stopped' | 'starting' | 'running' | 'paused' | 'completed' | 'error';
  error?: string | null;
  location?: LocationReading;
  timestamp: number;
  progress?: number;
  currentWaypoint?: number;
  remainingMeters?: number;
  elapsedSeconds?: number;
}

export interface StartOptions
  extends Partial<Omit<LocationConfig, 'latitude' | 'longitude'>>,
    Coordinate {
  updateIntervalMs?: number;
  durationSeconds?: number;
}

export interface RouteOptions {
  points: Coordinate[];
  speedKmh: number;
  accuracy?: number;
  altitude?: number;
  updateIntervalMs?: number;
  durationSeconds?: number;
  routeMode?: 'once' | 'loop';
}

interface NativeLocation {
  getPrerequisites(): Promise<Prerequisites>;
  captureRealLocation(): Promise<LocationReading>;
  /** Resolves false when Android opened general Settings as a fallback. */
  openSystemSettings(screen: SystemSettingsScreen): Promise<boolean>;
  getStatus(): Promise<SimulationStatus>;
  start(options: StartOptions): Promise<SimulationStatus>;
  startRoute(options: RouteOptions): Promise<SimulationStatus>;
  pause(): Promise<SimulationStatus>;
  resume(): Promise<SimulationStatus>;
  stop(): Promise<SimulationStatus>;
  addListener(event: string): void;
  removeListeners(count: number): void;
}

export const nativeLocation = NativeModules.MockLocation as
  | NativeLocation
  | undefined;

export function requireNative() {
  if (!nativeLocation) {
    throw new Error(
      'Native location module unavailable. Install the latest Android APK.',
    );
  }
  return nativeLocation;
}

export async function requestLocationPermission() {
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);
  if (
    result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] !==
    PermissionsAndroid.RESULTS.GRANTED
  ) {
    throw new Error(
      'Precise location permission was denied. Enable it in Android application settings.',
    );
  }
}

export async function ensureSimulationReady() {
  await requestLocationPermission();
  const prerequisites = await requireNative().getPrerequisites();
  if (!prerequisites.locationEnabled) {
    throw new Error(
      'Location services are disabled. Enable Location in Android settings.',
    );
  }
  if (!prerequisites.mockAppSelected) {
    throw new Error(
      'Mock location is not enabled for this application. Select this application as the mock location app in Android Developer Options.',
    );
  }
  if (Number(Platform.Version) >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  }
}

export const MockLocation = {
  async start(options: StartOptions) {
    await ensureSimulationReady();
    return requireNative().start(options);
  },
  async startRoute(options: RouteOptions) {
    await ensureSimulationReady();
    return requireNative().startRoute(options);
  },
  pause: () => requireNative().pause(),
  resume: () => requireNative().resume(),
  stop: () => requireNative().stop(),
  getStatus: () => requireNative().getStatus(),
  subscribe(listener: (status: SimulationStatus) => void) {
    const subscription = new NativeEventEmitter(requireNative()).addListener(
      'MockLocationStatus',
      payload => {
        if (
          payload &&
          typeof payload === 'object' &&
          'state' in payload &&
          'timestamp' in payload &&
          typeof payload.timestamp === 'number' &&
          [
            'stopped',
            'starting',
            'running',
            'paused',
            'completed',
            'error',
          ].includes(String(payload.state))
        ) {
          listener(payload as SimulationStatus);
        }
      },
    );
    return () => subscription.remove();
  },
};
