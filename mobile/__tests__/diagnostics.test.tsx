import React from 'react';
import { NativeModules, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = require('react-native');
  return {
    Map: View,
    Camera: View,
    ViewAnnotation: View,
    GeoJSONSource: View,
    Layer: View,
  };
});
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const crashReport =
  'Time: 2026-10-21 18:00:00 UTC\nSource: React Native\n\njava.lang.IllegalStateException: boom';
const native = {
  getLastCrashReport: jest.fn(),
  clearLastCrashReport: jest.fn().mockResolvedValue(null),
  getStatus: jest.fn().mockResolvedValue({ state: 'stopped', timestamp: 0 }),
  getPrerequisites: jest.fn().mockResolvedValue({
    developerOptionsEnabled: true,
    mockAppSelected: true,
    permissionGranted: true,
    locationEnabled: true,
    notificationsEnabled: true,
  }),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};
NativeModules.MockLocation = native;

const App = (require('../App') as typeof import('../App')).default;
const { STARTUP_TIMEOUT_MS } = require('../App') as typeof import('../App');
const { ErrorBoundary } =
  require('../src/components/ErrorBoundary') as typeof import('../src/components/ErrorBoundary');
const { EmulatorScreen } =
  require('../src/screens/EmulatorScreen') as typeof import('../src/screens/EmulatorScreen');
const diagnostics =
  require('../src/services/diagnostics') as typeof import('../src/services/diagnostics');
const { usePersistenceStatus } =
  require('../src/services/localStorage') as typeof import('../src/services/localStorage');

const act = ReactTestRenderer.act;
let app: ReactTestRenderer.ReactTestRenderer | undefined;

const control = (label: string) =>
  app!.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
const hasText = (text: string) =>
  app!.root
    .findAllByType(Text)
    .some(node =>
      React.Children.toArray(node.props.children).join('').includes(text),
    );

beforeEach(() => {
  jest.clearAllMocks();
  native.getLastCrashReport.mockResolvedValue(null);
  diagnostics.useDiagnosticsStore.setState({
    fatalError: null,
    crashReport: null,
  });
  usePersistenceStatus.setState({ ready: true, error: null });
});

afterEach(async () => {
  if (app) {
    await act(async () => app!.unmount());
    app = undefined;
  }
});

async function renderApp() {
  await act(async () => {
    app = ReactTestRenderer.create(<App />);
  });
}

function Thrower(): React.ReactElement {
  throw new Error('Render exploded');
}

test('render errors show a readable error screen instead of a blank one', async () => {
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});
  try {
    await act(async () => {
      app = ReactTestRenderer.create(
        <ErrorBoundary
          renderFallback={(report, reset) => (
            <Text onPress={reset}>{`Failed: ${report.message}`}</Text>
          )}
        >
          <Thrower />
        </ErrorBoundary>,
      );
    });
    expect(hasText('Failed: Render exploded')).toBe(true);
  } finally {
    consoleError.mockRestore();
  }
});

test('fatal JavaScript errors are shown on screen and can be dismissed', async () => {
  await renderApp();
  await act(async () =>
    diagnostics.useDiagnosticsStore.setState({
      fatalError: diagnostics.describeError(new TypeError('x is undefined')),
    }),
  );
  expect(hasText('Something went wrong')).toBe(true);
  expect(hasText('x is undefined')).toBe(true);
  expect(control('Share details')).toBeDefined();
  await act(async () => control('Try again').props.onPress());
  expect(diagnostics.useDiagnosticsStore.getState().fatalError).toBeNull();
  expect(app!.root.findAllByType(EmulatorScreen)).toHaveLength(1);
});

test('the global handler records fatal errors without crashing the app', () => {
  const previous = jest.fn();
  let handler: ((error: unknown, isFatal?: boolean) => void) | undefined;
  const original = (globalThis as { ErrorUtils?: unknown }).ErrorUtils;
  (globalThis as { ErrorUtils?: unknown }).ErrorUtils = {
    getGlobalHandler: () => previous,
    setGlobalHandler: (next: typeof handler) => {
      handler = next;
    },
  };
  try {
    diagnostics.installGlobalErrorHandler();
    handler!(new Error('Event handler failed'), true);
    expect(diagnostics.useDiagnosticsStore.getState().fatalError?.message).toBe(
      'Event handler failed',
    );
    expect(previous).toHaveBeenCalledTimes(1);
    diagnostics.useDiagnosticsStore.setState({ fatalError: null });
    handler!(new Error('Minor'), false);
    expect(diagnostics.useDiagnosticsStore.getState().fatalError).toBeNull();
  } finally {
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = original;
  }
});

test('a crash from the previous run is shown once and can be shared or dismissed', async () => {
  native.getLastCrashReport.mockResolvedValue(crashReport);
  await renderApp();
  expect(hasText('The app closed unexpectedly last time')).toBe(true);
  expect(hasText('IllegalStateException: boom')).toBe(true);
  expect(control('Share report')).toBeDefined();
  await act(async () => control('Dismiss').props.onPress());
  expect(native.clearLastCrashReport).toHaveBeenCalledTimes(1);
  expect(hasText('The app closed unexpectedly last time')).toBe(false);
});

test('a stalled saved-data load cannot leave the app on a loading screen', async () => {
  jest.useFakeTimers();
  try {
    usePersistenceStatus.setState({ ready: false, error: null });
    await renderApp();
    expect(hasText('Loading saved places')).toBe(true);
    expect(app!.root.findAllByType(EmulatorScreen)).toHaveLength(0);
    await act(async () => jest.advanceTimersByTime(STARTUP_TIMEOUT_MS));
    expect(app!.root.findAllByType(EmulatorScreen)).toHaveLength(1);
    expect(usePersistenceStatus.getState().error).toContain('too long');
  } finally {
    jest.useRealTimers();
  }
});
