import { NativeModules, PermissionsAndroid } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const start = jest.fn().mockResolvedValue({ state: 'starting', timestamp: 0 });
const stop = jest.fn().mockResolvedValue({ state: 'stopped', timestamp: 0 });
const steer = jest.fn().mockResolvedValue({ state: 'running', timestamp: 1 });
const moveTo = jest.fn().mockResolvedValue({ state: 'running', timestamp: 1 });
NativeModules.MockLocation = {
  start,
  stop,
  steer,
  moveTo,
  pause: jest.fn().mockResolvedValue({ state: 'paused', timestamp: 0 }),
  resume: jest.fn().mockResolvedValue({ state: 'running', timestamp: 0 }),
  getStatus: jest.fn().mockResolvedValue({ state: 'stopped', timestamp: 0 }),
  getPrerequisites: jest.fn().mockResolvedValue({
    permissionGranted: true,
    locationEnabled: true,
    mockAppSelected: true,
  }),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

const { MockLocation } =
  require('../src/services/MockLocation') as typeof import('../src/services/MockLocation');
const { useSimulationStore } =
  require('../src/store/useSimulationStore') as typeof import('../src/store/useSimulationStore');

test('lifecycle commands cross the native boundary and status updates reach state', async () => {
  await MockLocation.pause();
  await MockLocation.resume();
  await MockLocation.stop();
  expect(stop).toHaveBeenCalledTimes(1);
  expect(NativeModules.MockLocation.pause).toHaveBeenCalledTimes(1);
  useSimulationStore.getState().setStatus({ state: 'paused', timestamp: 1 });
  expect(useSimulationStore.getState().status.state).toBe('paused');
});

test('service errors are surfaced and busy state resets', async () => {
  await useSimulationStore.getState().run(async () => {
    throw new Error('Location services are disabled.');
  });
  expect(useSimulationStore.getState().error).toContain('Location services');
  expect(useSimulationStore.getState().busy).toBe(false);
});

test('a delayed status refresh cannot overwrite a newer event', async () => {
  const { refreshSimulation } =
    require('../src/store/useSimulationStore') as typeof import('../src/store/useSimulationStore');
  let resolveStatus!: (value: { state: string; timestamp: number }) => void;
  NativeModules.MockLocation.getStatus.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveStatus = resolve;
      }),
  );
  const pending = refreshSimulation();
  useSimulationStore.getState().setStatus({ state: 'running', timestamp: 2 });
  resolveStatus({ state: 'stopped', timestamp: 1 });
  await pending;
  expect(useSimulationStore.getState().status.state).toBe('running');
});

test('joystick start, steering and moving cross the native boundary', async () => {
  const { simulationActions } =
    require('../src/store/useSimulationStore') as typeof import('../src/store/useSimulationStore');
  const { useLocationStore } =
    require('../src/store/useLocationStore') as typeof import('../src/store/useLocationStore');
  jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
    [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: 'granted',
  } as never);
  useLocationStore.setState({ recent: [] });
  await simulationActions.startAt(
    { latitude: 12, longitude: 77 },
    { joystick: true, name: 'Park' },
  );
  expect(useSimulationStore.getState().error).toBeNull();
  expect(start).toHaveBeenLastCalledWith(
    expect.objectContaining({ latitude: 12, longitude: 77, speed: 0 }),
  );
  expect(useLocationStore.getState().selected).toEqual({
    latitude: 12,
    longitude: 77,
  });
  expect(useLocationStore.getState().recent[0].name).toBe('Park');
  await simulationActions.steer(45, 1.5);
  expect(steer).toHaveBeenCalledWith(45, 1.5);
  await simulationActions.moveHere({ latitude: 13, longitude: 78 });
  expect(moveTo).toHaveBeenCalledWith(13, 78);
  expect(useLocationStore.getState().recent[0]).toMatchObject({
    latitude: 13,
    longitude: 78,
  });
});

test('steering failures surface without throwing', async () => {
  const { simulationActions } =
    require('../src/store/useSimulationStore') as typeof import('../src/store/useSimulationStore');
  steer.mockRejectedValueOnce(new Error('Start a location simulation first.'));
  await expect(simulationActions.steer(0, 1)).resolves.toBeUndefined();
  expect(useSimulationStore.getState().error).toBe(
    'Start a location simulation first.',
  );
});
