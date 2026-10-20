import { NativeModules } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const start = jest.fn().mockResolvedValue({ state: 'starting', timestamp: 0 });
const stop = jest.fn().mockResolvedValue({ state: 'stopped', timestamp: 0 });
NativeModules.MockLocation = {
  start,
  stop,
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
