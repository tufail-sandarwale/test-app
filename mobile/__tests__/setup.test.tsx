import React from 'react';
import { Alert, NativeModules } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActionButton } from '../src/components/ActionButton';
import { Reading } from '../src/components/Screen';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const ready = {
  developerOptionsEnabled: true,
  mockAppSelected: true,
  permissionGranted: true,
  locationEnabled: true,
  notificationsEnabled: true,
};
const getPrerequisites = jest.fn();
const openSystemSettings = jest.fn();
NativeModules.MockLocation = {
  getPrerequisites,
  openSystemSettings,
  getStatus: jest.fn().mockResolvedValue({ state: 'stopped', timestamp: 0 }),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

const { DeveloperSetupScreen } =
  require('../src/screens/DeveloperSetupScreen') as typeof import('../src/screens/DeveloperSetupScreen');
const { useSetupStore, setupActions, isReady } =
  require('../src/store/useSetupStore') as typeof import('../src/store/useSetupStore');
const { useSimulationStore } =
  require('../src/store/useSimulationStore') as typeof import('../src/store/useSimulationStore');

const Stack = createNativeStackNavigator();
let app: ReactTestRenderer.ReactTestRenderer;

async function render(prerequisites: typeof ready) {
  getPrerequisites.mockResolvedValue(prerequisites);
  await ReactTestRenderer.act(async () => {
    app = ReactTestRenderer.create(
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Setup" component={DeveloperSetupScreen} />
        </Stack.Navigator>
      </NavigationContainer>,
    );
  });
}

const buttons = () =>
  app.root.findAllByType(ActionButton).map(node => node.props);
const button = (label: string) =>
  buttons().find(props => props.label === label);
const reading = (label: string) =>
  app.root.findAllByType(Reading).find(node => node.props.label === label)
    ?.props.value;

beforeEach(() => {
  jest.clearAllMocks();
  openSystemSettings.mockResolvedValue(true);
  useSetupStore.setState({
    prerequisites: null,
    busy: false,
    error: null,
    message: null,
  });
  useSimulationStore.setState({ status: { state: 'stopped', timestamp: 0 } });
});

afterEach(async () => {
  await ReactTestRenderer.act(async () => app?.unmount());
});

test('disabled Developer Options guides the user to About phone', async () => {
  await render({
    ...ready,
    developerOptionsEnabled: false,
    mockAppSelected: false,
  });
  expect(reading('Developer Options')).toBe('Disabled');
  expect(reading('Overall')).toBe('ACTION NEEDED');
  expect(button('Disable Developer Options')).toBeUndefined();
  expect(button('Select Mock Location App')?.disabled).toBe(true);
  await ReactTestRenderer.act(async () =>
    button('Enable Developer Options')!.onPress(),
  );
  expect(openSystemSettings).toHaveBeenCalledWith('about');
});

test('enabled Developer Options can be opened or disabled after confirmation', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(ready);
  expect(reading('Overall')).toBe('READY TO SIMULATE');
  expect(button('Enable Developer Options')).toBeUndefined();
  await ReactTestRenderer.act(async () =>
    button('Disable Developer Options')!.onPress(),
  );
  const actions = alert.mock.calls[0][2]!;
  await ReactTestRenderer.act(async () => actions[1].onPress!());
  expect(openSystemSettings).toHaveBeenCalledWith('developer');
  alert.mockRestore();
});

test('disabling is blocked while a simulation is active', async () => {
  useSimulationStore.setState({ status: { state: 'running', timestamp: 1 } });
  await render(ready);
  expect(button('Disable Developer Options')?.disabled).toBe(true);
});

test('missing permission, location and notifications show fix buttons', async () => {
  await render({
    ...ready,
    permissionGranted: false,
    locationEnabled: false,
    notificationsEnabled: false,
  });
  expect(button('Grant Location Permission')).toBeDefined();
  expect(button('Open Location Settings')).toBeDefined();
  expect(button('Allow Notifications')).toBeDefined();
  await ReactTestRenderer.act(async () =>
    button('Open Location Settings')!.onPress(),
  );
  expect(openSystemSettings).toHaveBeenCalledWith('location');
});

test('fallback to general Settings and native errors are reported', async () => {
  openSystemSettings.mockResolvedValueOnce(false);
  await setupActions.openSettings('developer');
  expect(useSetupStore.getState().message).toContain('general Settings');
  getPrerequisites.mockRejectedValueOnce(new Error('Settings unavailable'));
  await setupActions.refresh();
  expect(useSetupStore.getState().error).toBe('Settings unavailable');
  expect(useSetupStore.getState().busy).toBe(false);
});

test('notifications are recommended but not required to simulate', () => {
  expect(isReady({ ...ready, notificationsEnabled: false })).toBe(true);
  expect(isReady({ ...ready, developerOptionsEnabled: false })).toBe(false);
  expect(isReady(null)).toBe(false);
});
