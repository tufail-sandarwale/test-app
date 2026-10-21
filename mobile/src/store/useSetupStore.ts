import { PermissionsAndroid, Platform } from 'react-native';
import { create } from 'zustand';
import {
  requestLocationPermission,
  requireNative,
  type Prerequisites,
  type SystemSettingsScreen,
} from '../services/MockLocation';

interface SetupState {
  prerequisites: Prerequisites | null;
  busy: boolean;
  error: string | null;
  message: string | null;
}

export const useSetupStore = create<SetupState>(() => ({
  prerequisites: null,
  busy: false,
  error: null,
  message: null,
}));

export const isReady = (status: Prerequisites | null) =>
  !!status &&
  status.developerOptionsEnabled &&
  status.mockAppSelected &&
  status.permissionGranted &&
  status.locationEnabled;

async function run(action: () => Promise<void>) {
  if (useSetupStore.getState().busy) {
    return;
  }
  useSetupStore.setState({ busy: true, error: null, message: null });
  try {
    await action();
  } catch (problem) {
    useSetupStore.setState({
      error: problem instanceof Error ? problem.message : String(problem),
    });
  } finally {
    useSetupStore.setState({ busy: false });
  }
}

async function load() {
  useSetupStore.setState({
    prerequisites: await requireNative().getPrerequisites(),
  });
}

async function open(screen: SystemSettingsScreen) {
  const opened = await requireNative().openSystemSettings(screen);
  if (!opened) {
    useSetupStore.setState({
      message:
        'This phone opened general Settings. Use Settings search to find the option.',
    });
  }
}

export const setupActions = {
  refresh: () => run(load),
  requestLocation: () =>
    run(async () => {
      await requestLocationPermission();
      await load();
    }),
  requestNotifications: () =>
    run(async () => {
      if (Number(Platform.Version) >= 33) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          await open('app');
          return;
        }
      } else {
        await open('app');
        return;
      }
      await load();
    }),
  openSettings: (screen: SystemSettingsScreen) => run(() => open(screen)),
};
