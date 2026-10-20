import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Coordinate,
  LocationConfig,
  LocationPreset,
  RoutePreset,
  SimulationSettings,
} from '../types/location';
import { validateCoordinate } from '../utils/geo';
import {
  validateLocation,
  validateSettings,
  validateRoute,
  validName,
} from '../utils/validation';
import { localStorage, usePersistenceStatus } from '../services/localStorage';

export const defaultSettings: SimulationSettings = {
  updateIntervalMs: 1000,
  accuracy: 5,
  altitude: 0,
  bearing: 0,
  speedKmh: 5,
  radiusMeters: 100,
  durationSeconds: 0,
  routeMode: 'once',
  includeBoundary: false,
};

interface LocationState {
  presets: LocationPreset[];
  savedRoutes: RoutePreset[];
  selected: Coordinate | null;
  target: Coordinate | null;
  route: Coordinate[];
  settings: SimulationSettings;
  select: (coordinate: Coordinate) => void;
  setTarget: (coordinate: Coordinate) => void;
  addWaypoint: (coordinate: Coordinate) => void;
  clearRoute: () => void;
  updateSettings: (settings: SimulationSettings) => void;
  savePreset: (name: string, location: LocationConfig, id?: string) => void;
  deletePreset: (id: string) => void;
  selectPreset: (id: string) => void;
  replaceRoute: (points: Coordinate[]) => void;
  saveRoute: (name: string, id?: string) => void;
  importRoute: (name: string, points: Coordinate[], speedKmh: number) => void;
  deleteRoute: (id: string) => void;
  selectRoute: (id: string) => void;
}

const identifier = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      presets: [],
      savedRoutes: [],
      selected: null,
      target: null,
      route: [],
      settings: defaultSettings,
      select: coordinate => {
        validateCoordinate(coordinate);
        set({ selected: coordinate });
      },
      setTarget: coordinate => {
        validateCoordinate(coordinate);
        set({ target: coordinate });
      },
      addWaypoint: coordinate => {
        validateCoordinate(coordinate);
        set(state => {
          if (state.route.length >= 500) {
            throw new Error('Routes support at most 500 waypoints.');
          }
          return { route: [...state.route, coordinate] };
        });
      },
      clearRoute: () => set({ route: [] }),
      updateSettings: settings => {
        validateSettings(settings);
        set({ settings });
      },
      savePreset: (name, location, id) => {
        const trimmedName = validName(name);
        validateLocation(location);
        const existing = get().presets.find(preset => preset.id === id);
        if (id && !existing) {
          throw new Error('This location no longer exists.');
        }
        const now = new Date().toISOString();
        const preset = {
          ...location,
          id: id ?? identifier(),
          name: trimmedName,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        set(state => ({
          presets: [
            ...state.presets.filter(item => item.id !== preset.id),
            preset,
          ],
        }));
      },
      deletePreset: id =>
        set(state => ({
          presets: state.presets.filter(preset => preset.id !== id),
        })),
      selectPreset: id => {
        const preset = get().presets.find(item => item.id === id);
        if (!preset) {
          throw new Error('Saved location not found.');
        }
        set(state => ({
          selected: { latitude: preset.latitude, longitude: preset.longitude },
          settings: {
            ...state.settings,
            accuracy: preset.accuracy,
            altitude: preset.altitude,
            bearing: preset.bearing,
            speedKmh: preset.speed * 3.6,
          },
        }));
      },
      replaceRoute: points => {
        if (points.length > 500) {
          throw new Error('Routes support at most 500 waypoints.');
        }
        points.forEach(validateCoordinate);
        set({ route: points });
      },
      saveRoute: (name, id) => {
        const trimmedName = validName(name);
        const { route, settings, savedRoutes } = get();
        validateRoute(route, settings.speedKmh);
        const existing = savedRoutes.find(item => item.id === id);
        if (id && !existing) {
          throw new Error('This route no longer exists.');
        }
        const now = new Date().toISOString();
        const preset: RoutePreset = {
          id: id ?? identifier(),
          name: trimmedName,
          points: route.map(point => ({ ...point })),
          speedKmh: settings.speedKmh,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        set({
          savedRoutes: [
            ...savedRoutes.filter(item => item.id !== preset.id),
            preset,
          ],
        });
      },
      importRoute: (name, points, speedKmh) => {
        const trimmedName = validName(name);
        validateRoute(points, speedKmh);
        const now = new Date().toISOString();
        set(state => ({
          savedRoutes: [
            ...state.savedRoutes,
            {
              id: identifier(),
              name: trimmedName,
              points: points.map(point => ({ ...point })),
              speedKmh,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
      },
      deleteRoute: id =>
        set(state => ({
          savedRoutes: state.savedRoutes.filter(route => route.id !== id),
        })),
      selectRoute: id => {
        const preset = get().savedRoutes.find(item => item.id === id);
        if (!preset) {
          throw new Error('Saved route not found.');
        }
        set(state => ({
          route: preset.points.map(point => ({ ...point })),
          settings: { ...state.settings, speedKmh: preset.speedKmh },
        }));
      },
    }),
    {
      name: 'mock-gps-local-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        if (!persisted) {
          return current;
        }
        const data = persisted as LocationState;
        validateSettings(data.settings);
        if (data.selected !== null) {
          validateCoordinate(data.selected);
        }
        if (data.target !== null) {
          validateCoordinate(data.target);
        }
        if (
          !Array.isArray(data.route) ||
          data.route.length > 500 ||
          !Array.isArray(data.presets) ||
          !Array.isArray(data.savedRoutes)
        ) {
          throw new Error('Invalid saved data.');
        }
        data.route.forEach(validateCoordinate);
        const metadata = (item: LocationPreset | RoutePreset) => {
          validName(item.name);
          if (
            typeof item.id !== 'string' ||
            !item.id ||
            !Number.isFinite(Date.parse(item.createdAt)) ||
            !Number.isFinite(Date.parse(item.updatedAt))
          ) {
            throw new Error('Invalid saved preset.');
          }
        };
        data.presets.forEach(item => {
          metadata(item);
          validateLocation(item);
        });
        data.savedRoutes.forEach(item => {
          metadata(item);
          validateRoute(item.points, item.speedKmh);
        });
        return {
          ...current,
          selected: data.selected,
          target: data.target,
          route: data.route,
          settings: data.settings,
          presets: data.presets,
          savedRoutes: data.savedRoutes,
        };
      },
      partialize: state => ({
        selected: state.selected,
        target: state.target,
        route: state.route,
        settings: state.settings,
        presets: state.presets,
        savedRoutes: state.savedRoutes,
      }),
      onRehydrateStorage: () => (_state, error) =>
        usePersistenceStatus.setState({
          ready: true,
          error: error
            ? 'Saved data could not be loaded. Check device storage.'
            : null,
        }),
    },
  ),
);
