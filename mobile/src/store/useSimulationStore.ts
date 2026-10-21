import { create } from 'zustand';
import {
  MockLocation,
  requestLocationPermission,
  requireNative,
} from '../services/MockLocation';
import type {
  LocationReading,
  SimulationStatus,
} from '../services/MockLocation';
import { useLocationStore } from './useLocationStore';
import { validateRoute } from '../utils/validation';
import type { Coordinate } from '../types/location';

interface State {
  status: SimulationStatus;
  realLocation: LocationReading | null;
  busy: boolean;
  error: string | null;
  setStatus: (status: SimulationStatus) => void;
  run: (operation: () => Promise<unknown>) => Promise<void>;
}

export const useSimulationStore = create<State>((set, get) => ({
  status: { state: 'stopped', timestamp: 0 },
  realLocation: null,
  busy: false,
  error: null,
  setStatus: status => set({ status, error: status.error ?? null }),
  run: async operation => {
    if (get().busy) {
      return;
    }
    set({ busy: true, error: null });
    try {
      await operation();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      set({ busy: false });
    }
  },
}));

export async function refreshSimulation(isDisposed = () => false) {
  const previous = useSimulationStore.getState().status;
  const status = await MockLocation.getStatus();
  if (!isDisposed() && useSimulationStore.getState().status === previous) {
    useSimulationStore.getState().setStatus(status);
  }
}

export function connectSimulation() {
  const store = useSimulationStore.getState();
  let disposed = false;
  try {
    const unsubscribe = MockLocation.subscribe(status => {
      if (!disposed) {
        store.setStatus(status);
      }
    });
    refreshSimulation(() => disposed).catch(error => {
      if (!disposed) {
        useSimulationStore.setState({ error: String(error) });
      }
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  } catch (error) {
    useSimulationStore.setState({ error: String(error) });
    return () => {
      disposed = true;
    };
  }
}

export const simulationActions = {
  captureReal: () =>
    useSimulationStore.getState().run(async () => {
      await requestLocationPermission();
      const reading = await requireNative().captureRealLocation();
      useSimulationStore.setState({ realLocation: reading });
    }),
  start: () =>
    useSimulationStore.getState().run(async () => {
      const { selected, settings } = useLocationStore.getState();
      if (!selected) {
        throw new Error('Select a location first.');
      }
      await MockLocation.start({
        ...selected,
        ...settings,
        speed: settings.speedKmh / 3.6,
      });
      useLocationStore.getState().addRecent(selected);
    }),
  /** Selects a coordinate and mocks it. Joystick mode starts stationary; steering sets the speed. */
  startAt: (
    coordinate: Coordinate,
    options: { joystick?: boolean; name?: string } = {},
  ) =>
    useSimulationStore.getState().run(async () => {
      const store = useLocationStore.getState();
      store.select(coordinate);
      const { settings } = store;
      await MockLocation.start({
        ...coordinate,
        accuracy: settings.accuracy,
        altitude: settings.altitude,
        bearing: settings.bearing,
        updateIntervalMs: settings.updateIntervalMs,
        durationSeconds: settings.durationSeconds,
        speed: options.joystick ? 0 : settings.speedKmh / 3.6,
      });
      store.addRecent(coordinate, options.name);
    }),
  moveHere: (coordinate: Coordinate, name?: string) =>
    useSimulationStore.getState().run(async () => {
      const store = useLocationStore.getState();
      store.select(coordinate);
      await MockLocation.moveTo(coordinate);
      store.addRecent(coordinate, name);
    }),
  /** Fire-and-forget joystick input; bypasses the busy lock so frequent updates are not dropped. */
  steer: async (bearing: number, speedMetersPerSecond: number) => {
    try {
      await MockLocation.steer(bearing, speedMetersPerSecond);
    } catch (error) {
      useSimulationStore.setState({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  startRoute: () =>
    useSimulationStore.getState().run(async () => {
      const { route, settings } = useLocationStore.getState();
      validateRoute(route, settings.speedKmh);
      await MockLocation.startRoute({ ...settings, points: route });
    }),
  pause: () => useSimulationStore.getState().run(() => MockLocation.pause()),
  resume: () => useSimulationStore.getState().run(() => MockLocation.resume()),
  stop: () => useSimulationStore.getState().run(() => MockLocation.stop()),
};
