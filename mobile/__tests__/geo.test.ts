import {
  distanceMeters,
  insideRadius,
  interpolateRoute,
  validateCoordinate,
} from '../src/utils/geo';
import { useLocationStore } from '../src/store/useLocationStore';
import { validateRoute } from '../src/utils/validation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePersistenceStatus } from '../src/services/localStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

test('validates finite latitude and longitude', () => {
  expect(() => validateCoordinate({ latitude: 91, longitude: 0 })).toThrow(
    'Latitude',
  );
  expect(() => validateCoordinate({ latitude: 0, longitude: NaN })).toThrow(
    'Longitude',
  );
  expect(() =>
    validateCoordinate({ latitude: -90, longitude: 180 }),
  ).not.toThrow();
});

test('computes distances in meters and boundary policy', () => {
  expect(
    distanceMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    ),
  ).toBeCloseTo(111195, -1);
  expect(insideRadius(100, 100)).toBe(false);
  expect(insideRadius(100, 100, true)).toBe(true);
  expect(() => insideRadius(0, 0)).toThrow('Radius');
});

test('interpolates between route endpoints', () => {
  const points = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0.01 },
  ];
  const midpoint = interpolateRoute(
    points,
    distanceMeters(points[0], points[1]) / 2,
  );
  expect(midpoint.longitude).toBeCloseTo(0.005, 6);
  expect(interpolateRoute(points, 100000).longitude).toBeCloseTo(0.01);
});

test('invalid selections do not overwrite shared state', () => {
  useLocationStore.getState().select({ latitude: 19, longitude: 72 });
  expect(() =>
    useLocationStore.getState().select({ latitude: Infinity, longitude: 0 }),
  ).toThrow();
  expect(useLocationStore.getState().selected).toEqual({
    latitude: 19,
    longitude: 72,
  });
});

test('saved locations support create, edit, select and delete', () => {
  const store = useLocationStore.getState();
  store.savePreset('Office', {
    latitude: 19,
    longitude: 72,
    accuracy: 5,
    altitude: 0,
    bearing: 0,
    speed: 1,
  });
  const preset = useLocationStore.getState().presets[0];
  store.savePreset('Updated office', { ...preset, latitude: 20 }, preset.id);
  store.selectPreset(preset.id);
  expect(useLocationStore.getState().selected?.latitude).toBe(20);
  expect(useLocationStore.getState().presets[0].createdAt).toBe(
    preset.createdAt,
  );
  store.deletePreset(preset.id);
  expect(useLocationStore.getState().presets).toHaveLength(0);
});

test('routes validate, persist and reload without losing local actions', async () => {
  const store = useLocationStore.getState();
  const points = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0.01 },
  ];
  expect(() => validateRoute(points, 0)).toThrow('speed');
  expect(() => validateRoute([points[0], points[0]], 5)).toThrow('distinct');
  store.replaceRoute(points);
  store.saveRoute('Walk');
  const saved = useLocationStore.getState().savedRoutes[0];
  await useLocationStore.persist.rehydrate();
  store.clearRoute();
  useLocationStore.getState().selectRoute(saved.id);
  expect(useLocationStore.getState().route).toEqual(points);
  store.deleteRoute(saved.id);
  expect(useLocationStore.getState().savedRoutes).toHaveLength(0);
});

test('corrupt persisted coordinates are rejected without replacing good state', async () => {
  const before = useLocationStore.getState().selected;
  await AsyncStorage.setItem(
    'mock-gps-local-v1',
    JSON.stringify({
      version: 1,
      state: {
        ...useLocationStore.getState(),
        selected: { latitude: 999, longitude: 0 },
      },
    }),
  );
  await useLocationStore.persist.rehydrate();
  expect(useLocationStore.getState().selected).toEqual(before);
  expect(usePersistenceStatus.getState().error).toContain(
    'could not be loaded',
  );
  expect(usePersistenceStatus.getState().ready).toBe(true);
});
