import AsyncStorage from '@react-native-async-storage/async-storage';

export const MAP_GUARD_KEY = 'mock-gps-map-guard-v1';

/**
 * True when the map was starting during the previous run and never reported
 * that it rendered or failed, which means it probably froze or crashed the app.
 */
export async function mapFailedLastTime() {
  try {
    return (await AsyncStorage.getItem(MAP_GUARD_KEY)) === 'starting';
  } catch {
    return false;
  }
}

export async function markMapStarting() {
  try {
    await AsyncStorage.setItem(MAP_GUARD_KEY, 'starting');
  } catch {
    // Without the guard the map still starts; only crash recovery is lost.
  }
}

export async function markMapHealthy() {
  try {
    await AsyncStorage.removeItem(MAP_GUARD_KEY);
  } catch {
    // A stale guard only shows the "load map" prompt once more.
  }
}
