import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { ActionButton } from '../src/components/ActionButton';
import {
  LocationDetailsScreen,
  SavedLocationsScreen,
  SettingsScreen,
  StatusScreen,
} from '../src/screens/PhaseOneScreens';
import { EmulatorScreen } from '../src/screens/EmulatorScreen';
import { RoutesScreen } from '../src/screens/RoutesScreen';
import { CloudScreen } from '../src/screens/CloudScreen';
import { DeveloperSetupScreen } from '../src/screens/DeveloperSetupScreen';
import { useLocationStore } from '../src/store/useLocationStore';
import { useSimulationStore } from '../src/store/useSimulationStore';
import { usePersistenceStatus } from '../src/services/localStorage';

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

let app: ReactTestRenderer.ReactTestRenderer;

beforeEach(async () => {
  usePersistenceStatus.setState({ ready: true });
  useLocationStore.setState({
    selected: null,
    target: null,
    route: [],
    presets: [],
    savedRoutes: [],
    recent: [],
  });
  useSimulationStore.setState({
    status: { state: 'stopped', timestamp: 0 },
    busy: false,
    error: null,
  });
  await ReactTestRenderer.act(async () => {
    app = ReactTestRenderer.create(<App />);
  });
});

afterEach(async () => {
  await ReactTestRenderer.act(async () => app.unmount());
});

const control = (label: string) =>
  app.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];

async function tap(label: string) {
  const node = control(label);
  expect(node).toBeDefined();
  await ReactTestRenderer.act(async () => node.props.onPress());
}

async function press(label: string) {
  const button = app.root
    .findAllByType(ActionButton)
    .find(node => node.props.label === label);
  expect(button).toBeDefined();
  await ReactTestRenderer.act(async () => button!.props.onPress());
}

const currentRoute = () =>
  app.root.findByType(EmulatorScreen).props.navigation.getState().routes.at(-1)
    ?.name;

test('opens on the full-screen emulator with play disabled without the native service', () => {
  expect(app.root.findAllByType(EmulatorScreen)).toHaveLength(1);
  expect(control('Start mocking').props.disabled).toBe(true);
  expect(control('Location mode').props.accessibilityState.selected).toBe(true);
});

test.each([
  ['Favorites & history', SavedLocationsScreen],
  ['Saved routes', RoutesScreen],
  ['Enter coordinates', LocationDetailsScreen],
  ['Simulation status', StatusScreen],
  ['Settings', SettingsScreen],
  ['Device setup', DeveloperSetupScreen],
  ['Cloud presets', CloudScreen],
] as const)('the side menu opens %s', async (label, component) => {
  await tap('Open menu');
  await tap(label);
  expect(app.root.findAllByType(component)).toHaveLength(1);
});

test.each(['Start Simulation', 'Pause', 'Resume', 'Stop'])(
  'status screen %s stays disabled without the native service',
  async label => {
    await tap('Open menu');
    await tap('Simulation status');
    const button = app.root
      .findAllByType(ActionButton)
      .find(node => node.props.label === label);
    expect(button?.props.disabled).toBe(true);
  },
);

test('opens location details from the map and returns to the map', async () => {
  await tap('Coordinates…');
  expect(currentRoute()).toBe('LocationDetails');
  const navigation = app.root.findByType(EmulatorScreen).props.navigation;
  await ReactTestRenderer.act(async () => navigation.goBack());
  expect(currentRoute()).toBe('Home');
});

test('opens location details from favorites', async () => {
  await tap('Favorites');
  await press('Create Location');
  expect(app.root.findAllByType(LocationDetailsScreen)).toHaveLength(1);
});

test('saved routes return to the map in route mode', async () => {
  await tap('Open menu');
  await tap('Saved routes');
  await press('Add Waypoints on Map');
  expect(currentRoute()).toBe('Home');
  expect(control('Route mode').props.accessibilityState.selected).toBe(true);
});

test('a stalled map offers retry without blocking manual coordinates', async () => {
  jest.useFakeTimers();
  try {
    await ReactTestRenderer.act(async () => app.unmount());
    await ReactTestRenderer.act(async () => {
      app = ReactTestRenderer.create(<App />);
    });
    await ReactTestRenderer.act(async () => jest.advanceTimersByTime(15000));
    expect(control('Retry Map')).toBeDefined();
    await tap('Retry Map');
    expect(control('Retry Map')).toBeUndefined();
    await tap('Coordinates…');
    expect(app.root.findAllByType(LocationDetailsScreen)).toHaveLength(1);
  } finally {
    jest.useRealTimers();
  }
});
