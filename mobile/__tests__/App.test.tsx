import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { ActionButton } from '../src/components/ActionButton';
import {
  MapScreen,
  SavedLocationsScreen,
  SettingsScreen,
  LocationDetailsScreen,
} from '../src/screens/PhaseOneScreens';
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
  });
  useSimulationStore.setState({
    status: { state: 'stopped', timestamp: 0 },
    busy: false,
  });
  await ReactTestRenderer.act(async () => {
    app = ReactTestRenderer.create(<App />);
  });
});

afterEach(async () => {
  await ReactTestRenderer.act(async () => app.unmount());
});

async function press(label: string) {
  const button = app.root
    .findAllByType(ActionButton)
    .find(node => node.props.label === label);
  expect(button).toBeDefined();
  await ReactTestRenderer.act(async () => button!.props.onPress());
}

test.each(['Start Simulation', 'Pause', 'Resume', 'Stop'])(
  '%s stays disabled without the native service',
  label => {
    const button = app.root
      .findAllByType(ActionButton)
      .find(node => node.props.label === label);
    expect(button?.props.disabled).toBe(true);
  },
);

test.each([
  ['Saved Locations', SavedLocationsScreen],
  ['Open Settings', SettingsScreen],
  ['Routes', RoutesScreen],
  ['Cloud Presets', CloudScreen],
  ['Device Setup', DeveloperSetupScreen],
] as const)('%s opens its destination', async (label, component) => {
  await press(label);
  expect(app.root.findAllByType(component)).toHaveLength(1);
});

test('opens location details from the map and returns to the map', async () => {
  await press('Select Location');
  const navigation = app.root.findByType(MapScreen).props.navigation;
  await press('Enter Location Details');
  expect(navigation.getState().routes.at(-1)?.name).toBe('LocationDetails');
  await ReactTestRenderer.act(async () => navigation.goBack());
  expect(navigation.getState().routes.at(-1)?.name).toBe('Map');
});

test('opens location details from saved locations', async () => {
  await press('Saved Locations');
  await press('Create Location');
  expect(app.root.findAllByType(LocationDetailsScreen)).toHaveLength(1);
});

test('a stalled map offers retry without blocking manual coordinates', async () => {
  jest.useFakeTimers();
  try {
    await press('Select Location');
    await ReactTestRenderer.act(async () => jest.advanceTimersByTime(15000));
    expect(
      app.root
        .findAllByType(ActionButton)
        .some(node => node.props.label === 'Retry Map'),
    ).toBe(true);
    await press('Enter Location Details');
    expect(app.root.findAllByType(LocationDetailsScreen)).toHaveLength(1);
  } finally {
    jest.useRealTimers();
  }
});
