import axios, { type AxiosInstance } from 'axios';
import { create } from 'zustand';
import type { LocationPreset, RoutePreset } from '../types/location';
import {
  validateLocation,
  validateRoute,
  validName,
} from '../utils/validation';
import { useLocationStore } from '../store/useLocationStore';

type Resource = 'locations' | 'routes';
let client: AxiosInstance | null = null;

export function serverURL(value: string) {
  const url = new URL(value.trim());
  const local =
    __DEV__ && ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Use an HTTPS server URL. Debug builds also allow local HTTP.',
    );
  }
  return url.toString().replace(/\/$/, '') + '/api/v1';
}

export function cloudError(problem: unknown) {
  if (!axios.isAxiosError(problem)) {
    return problem instanceof Error ? problem.message : 'Cloud request failed.';
  }
  if (problem.response?.status === 401) {
    client = null;
    useCloudStore.setState({ connected: false, locations: [], routes: [] });
    return 'Invalid credentials or expired session. Sign in again.';
  }
  if (problem.response?.status === 429) {
    return 'Too many requests. Try again in a minute.';
  }
  if (problem.response?.status === 409) {
    return 'That account is already registered.';
  }
  if (problem.response?.status === 422) {
    return 'Check the account or preset fields and try again.';
  }
  if (problem.code === 'ECONNABORTED') {
    return 'Cloud request timed out. Local simulation is still available.';
  }
  if (!problem.response) {
    return 'Cannot reach the server. Check the address and connection.';
  }
  return 'The server could not complete this request.';
}

function api() {
  if (!client) {
    throw new Error('Sign in to the cloud first.');
  }
  return client;
}

export function validateCloudPreset(value: unknown, resource: Resource) {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid server response.');
  }
  const item = value as LocationPreset & RoutePreset;
  validName(item.name);
  if (
    typeof item.id !== 'string' ||
    !item.id ||
    !Number.isFinite(Date.parse(item.createdAt)) ||
    !Number.isFinite(Date.parse(item.updatedAt))
  ) {
    throw new Error('Invalid server preset.');
  }
  if (resource === 'locations') {
    validateLocation(item);
  } else {
    validateRoute(item.points, item.speedKmh);
  }
}

export const useCloudStore = create<{
  connected: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  locations: LocationPreset[];
  routes: RoutePreset[];
  run: (action: () => Promise<void>) => Promise<void>;
}>(set => ({
  connected: false,
  busy: false,
  error: null,
  message: null,
  locations: [],
  routes: [],
  run: async action => {
    if (useCloudStore.getState().busy) {
      return;
    }
    set({ busy: true, error: null, message: null });
    try {
      await action();
    } catch (problem) {
      set({ error: cloudError(problem) });
    } finally {
      set({ busy: false });
    }
  },
}));

async function list(resource: Resource, offset = 0) {
  const { data } = await api().get<unknown>(`/${resource}`, {
    params: { offset, limit: 100 },
  });
  if (!Array.isArray(data) || data.length > 100) {
    throw new Error('Invalid server collection.');
  }
  data.forEach(item => validateCloudPreset(item, resource));
  return data;
}

export const cloudActions = {
  async authenticate(
    url: string,
    email: string,
    password: string,
    register: boolean,
  ) {
    if (!email.trim() || password.length < 12 || password.length > 128) {
      throw new Error('Enter an email and a password of 12 to 128 characters.');
    }
    const connection = axios.create({
      baseURL: serverURL(url),
      timeout: 10000,
    });
    const { data } = await connection.post<{ access_token: string }>(
      `/auth/${register ? 'register' : 'login'}`,
      { email: email.trim(), password },
    );
    if (typeof data.access_token !== 'string' || !data.access_token) {
      throw new Error('Invalid authentication response.');
    }
    connection.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
    client = connection;
    useCloudStore.setState({ connected: true, locations: [], routes: [] });
    await cloudActions.refresh();
  },
  async refresh() {
    const [locations, routes] = await Promise.all([
      list('locations'),
      list('routes'),
    ]);
    useCloudStore.setState({ locations, routes });
  },
  async loadMore(resource: Resource) {
    const existing = useCloudStore.getState()[resource];
    const items = await list(resource, existing.length);
    useCloudStore.setState({
      [resource]: [...existing, ...items],
      message: items.length ? 'More presets loaded.' : 'All presets loaded.',
    });
  },
  logout() {
    client = null;
    useCloudStore.setState({
      connected: false,
      locations: [],
      routes: [],
      error: null,
      message: null,
    });
  },
  async upload(resource: Resource, item: LocationPreset | RoutePreset) {
    validateCloudPreset(item, resource);
    const data =
      resource === 'locations'
        ? ((location: LocationPreset) => ({
            name: location.name,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            altitude: location.altitude,
            bearing: location.bearing,
            speed: location.speed,
          }))(item as LocationPreset)
        : ((route: RoutePreset) => ({
            name: route.name,
            points: route.points,
            speedKmh: route.speedKmh,
          }))(item as RoutePreset);
    await api().post(`/${resource}`, data);
    await cloudActions.refresh();
    useCloudStore.setState({ message: 'A new cloud copy was saved.' });
  },
  async remove(resource: Resource, id: string) {
    await api().delete(`/${resource}/${encodeURIComponent(id)}`);
    useCloudStore.setState(state => ({
      [resource]: state[resource].filter(item => item.id !== id),
      message: 'Cloud copy deleted.',
    }));
  },
  async download(resource: Resource, item: LocationPreset | RoutePreset) {
    validateCloudPreset(item, resource);
    const store = useLocationStore.getState();
    if (resource === 'locations') {
      const location = item as LocationPreset;
      store.savePreset(location.name, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        altitude: location.altitude,
        bearing: location.bearing,
        speed: location.speed,
      });
    } else {
      const route = item as RoutePreset;
      store.importRoute(route.name, route.points, route.speedKmh);
    }
    useCloudStore.setState({ message: 'A new local copy was saved.' });
  },
};
