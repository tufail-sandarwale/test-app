import axios from 'axios';
import {
  cloudActions,
  cloudError,
  serverURL,
  useCloudStore,
  validateCloudPreset,
} from '../src/services/cloud';
import { useLocationStore } from '../src/store/useLocationStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('axios');

const preset = {
  id: 'cloud-id',
  name: 'Office',
  latitude: 19,
  longitude: 72,
  accuracy: 5,
  altitude: 0,
  bearing: 0,
  speed: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test('requires secure URLs except local debug servers', () => {
  expect(serverURL('https://example.com')).toBe('https://example.com/api/v1');
  expect(serverURL('http://10.0.2.2:8000')).toContain('/api/v1');
  expect(() => serverURL('http://example.com')).toThrow('HTTPS');
  expect(() => serverURL('https://user:password@example.com')).toThrow();
});

test('rejects malformed server data and imports a new local copy', async () => {
  expect(() =>
    validateCloudPreset({ ...preset, latitude: 91 }, 'locations'),
  ).toThrow();
  await cloudActions.download('locations', preset);
  const local = useLocationStore.getState().presets.at(-1);
  expect(local?.name).toBe('Office');
  expect(local?.id).not.toBe(preset.id);
});

test('authenticates then sends bounded cloud requests and clears session', async () => {
  const connection = {
    post: jest.fn().mockResolvedValue({ data: { access_token: 'test-token' } }),
    get: jest.fn().mockResolvedValue({ data: [] }),
    defaults: { headers: { common: {} } },
  };
  jest.mocked(axios.create).mockReturnValue(connection as never);
  await cloudActions.authenticate(
    'https://example.com',
    'test@example.com',
    'test-password-123',
    false,
  );
  expect(axios.create).toHaveBeenCalledWith({
    baseURL: 'https://example.com/api/v1',
    timeout: 10000,
  });
  expect(useCloudStore.getState().connected).toBe(true);
  expect(connection.defaults.headers.common).toEqual({
    Authorization: 'Bearer test-token',
  });
  cloudActions.logout();
  expect(useCloudStore.getState().connected).toBe(false);
});

test('offline and expired sessions do not alter simulation state', () => {
  jest.mocked(axios.isAxiosError).mockReturnValue(true);
  expect(cloudError({ code: 'ECONNABORTED' })).toContain('timed out');
  expect(cloudError({ response: { status: 401 } })).toContain('Sign in');
  expect(useCloudStore.getState().connected).toBe(false);
});

test('route imports leave the active route and settings untouched', async () => {
  const before = useLocationStore.getState();
  await cloudActions.download('routes', {
    id: 'remote-route',
    name: 'Walk',
    points: [
      { latitude: 1, longitude: 1 },
      { latitude: 2, longitude: 2 },
    ],
    speedKmh: 10,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
  });
  expect(useLocationStore.getState().route).toBe(before.route);
  expect(useLocationStore.getState().settings).toBe(before.settings);
  expect(useLocationStore.getState().savedRoutes.at(-1)?.speedKmh).toBe(10);
});
