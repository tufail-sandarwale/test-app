import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultSettings, useLocationStore } from '../store/useLocationStore';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { usePersistenceStatus } from './localStorage';
import { MAP_GUARD_KEY } from './mapGuard';

/** Clears favorites, routes, history, settings and preferences on this device. */
export async function resetSavedData() {
  await AsyncStorage.multiRemove([
    'mock-gps-local-v1',
    'mock-gps-preferences-v1',
    MAP_GUARD_KEY,
  ]);
  useLocationStore.setState({
    presets: [],
    savedRoutes: [],
    recent: [],
    selected: null,
    target: null,
    route: [],
    settings: defaultSettings,
  });
  usePreferencesStore.setState({ mapStyle: 'streets', joystickSpeedKmh: 5 });
  usePersistenceStatus.setState({ ready: true, error: null });
}
