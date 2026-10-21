import { useCallback, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActionButton } from '../components/ActionButton';
import { Field, ErrorMessage } from '../components/Field';
import { Reading, Screen, SectionTitle } from '../components/Screen';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useLocationStore } from '../store/useLocationStore';
import {
  useSimulationStore,
  simulationActions,
} from '../store/useSimulationStore';
import { nativeLocation } from '../services/MockLocation';
import { isReady, setupActions, useSetupStore } from '../store/useSetupStore';
import { distanceMeters, insideRadius } from '../utils/geo';
import { usePersistenceStatus } from '../services/localStorage';
import { applyLocationDraft, locationDraft } from '../services/locationEditor';
import { numberValue } from '../utils/validation';
import type { SimulationSettings } from '../types/location';

type HomeProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export { MapScreen } from './MapScreen';

export function HomeScreen({ navigation }: HomeProps) {
  const { status, realLocation, error, busy } = useSimulationStore();
  const { selected, target, settings } = useLocationStore();
  const setup = useSetupStore(state => state.prerequisites);
  const storageError = usePersistenceStatus(state => state.error);
  const active = ['starting', 'running', 'paused'].includes(status.state);
  const location = status.location;
  const distance = target && location ? distanceMeters(target, location) : null;
  const disabled = !nativeLocation || busy;
  useFocusEffect(
    useCallback(() => {
      if (nativeLocation) {
        setupActions.refresh();
      }
    }, []),
  );
  return (
    <Screen>
      <SectionTitle>Simulation</SectionTitle>
      <ErrorMessage message={error} />
      <ErrorMessage message={storageError} />
      <Reading
        label="Device setup"
        value={
          setup ? (isReady(setup) ? 'Ready' : 'Action needed') : 'Not checked'
        }
      />
      <ActionButton
        label="Device Setup"
        onPress={() => navigation.navigate('DeveloperSetup')}
      />
      <Reading
        label="Status"
        value={
          nativeLocation
            ? status.state.toUpperCase()
            : 'Native service unavailable'
        }
      />
      <Reading
        label="Real location (captured)"
        value={
          realLocation
            ? `${realLocation.latitude.toFixed(
                6,
              )}, ${realLocation.longitude.toFixed(6)}`
            : 'Not captured'
        }
      />
      {realLocation && (
        <Reading
          label="Captured at"
          value={new Date(realLocation.timestamp).toLocaleTimeString()}
        />
      )}
      <ActionButton
        label="Capture Real Location"
        disabled={disabled || active}
        onPress={simulationActions.captureReal}
      />
      <Reading
        label="Selected location"
        value={
          selected
            ? `${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(
                6,
              )}`
            : 'Not selected'
        }
      />
      <Reading
        label="Latitude (last simulated)"
        value={location?.latitude.toFixed(6) ?? '--'}
      />
      <Reading
        label="Longitude (last simulated)"
        value={location?.longitude.toFixed(6) ?? '--'}
      />
      <Reading
        label="Accuracy"
        value={location ? `${location.accuracy} m` : '--'}
      />
      <Reading
        label="Speed"
        value={location ? `${(location.speed * 3.6).toFixed(1)} km/h` : '--'}
      />
      <Reading
        label="Distance from target"
        value={distance !== null ? `${distance.toFixed(1)} m` : '--'}
      />
      <Reading
        label="Radius status"
        value={
          distance !== null
            ? insideRadius(
                distance,
                settings.radiusMeters,
                settings.includeBoundary,
              )
              ? 'INSIDE'
              : 'OUTSIDE'
            : 'No target or simulated reading'
        }
      />
      <Reading
        label="Route progress"
        value={`${(status.progress ?? 0).toFixed(1)}%`}
      />
      <Reading
        label="Current waypoint"
        value={String(status.currentWaypoint ?? 0)}
      />
      <Reading
        label="Remaining distance"
        value={`${(status.remainingMeters ?? 0).toFixed(1)} m`}
      />
      <ActionButton
        label="Select Location"
        onPress={() => navigation.navigate('Map')}
      />
      <ActionButton
        label="Start Simulation"
        disabled={disabled || active || !selected}
        onPress={simulationActions.start}
      />
      <ActionButton
        label="Pause"
        disabled={disabled || status.state !== 'running'}
        onPress={simulationActions.pause}
      />
      <ActionButton
        label="Resume"
        disabled={disabled || status.state !== 'paused'}
        onPress={simulationActions.resume}
      />
      <ActionButton
        label="Stop"
        disabled={disabled || !active}
        onPress={() =>
          Alert.alert('Stop simulation?', 'Mock providers will be removed.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Stop',
              style: 'destructive',
              onPress: simulationActions.stop,
            },
          ])
        }
      />
      <ActionButton
        label="Routes"
        onPress={() => navigation.navigate('Routes')}
      />
      <ActionButton
        label="Saved Locations"
        onPress={() => navigation.navigate('SavedLocations')}
      />
      <ActionButton
        label="Open Settings"
        onPress={() => navigation.navigate('Settings')}
      />
      <ActionButton
        label="Cloud Presets"
        onPress={() => navigation.navigate('Cloud')}
      />
    </Screen>
  );
}

export function LocationDetailsScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'LocationDetails'>) {
  const id = route.params?.id;
  const [draft, setDraft] = useState(() => locationDraft(id));
  const [error, setError] = useState<string | null>(null);
  const submit = (save: boolean, start: boolean) => {
    try {
      applyLocationDraft(draft, save, id);
      setError(null);
      navigation.navigate('Home');
      if (start) {
        simulationActions.start();
      }
    } catch (problem) {
      setError(String(problem));
    }
  };
  return (
    <Screen>
      <SectionTitle>{id ? 'Edit Location' : 'Location Details'}</SectionTitle>
      <ErrorMessage message={error} />
      {(Object.keys(draft) as (keyof typeof draft)[]).map(key => (
        <Field
          key={key}
          label={
            key === 'speed'
              ? 'Speed (m/s)'
              : key[0].toUpperCase() + key.slice(1)
          }
          value={draft[key]}
          numeric={key !== 'name'}
          onChange={value => setDraft({ ...draft, [key]: value })}
        />
      ))}
      <ActionButton label="Save" onPress={() => submit(true, false)} />
      <ActionButton
        label="Select Location"
        onPress={() => submit(false, false)}
      />
      <ActionButton
        label="Start Simulation"
        onPress={() => submit(false, true)}
      />
    </Screen>
  );
}

export function SavedLocationsScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'SavedLocations'>) {
  const { presets, deletePreset, selectPreset } = useLocationStore();
  return (
    <Screen>
      <SectionTitle>Saved Locations</SectionTitle>
      <Reading label="Locations" value={String(presets.length)} />
      {presets.map(preset => (
        <View key={preset.id}>
          <SectionTitle>{preset.name}</SectionTitle>
          <Reading
            label="Coordinates"
            value={`${preset.latitude.toFixed(6)}, ${preset.longitude.toFixed(
              6,
            )}`}
          />
          <ActionButton
            label={`Select ${preset.name}`}
            onPress={() => {
              selectPreset(preset.id);
              navigation.navigate('Home');
            }}
          />
          <ActionButton
            label={`Start ${preset.name}`}
            onPress={() => {
              selectPreset(preset.id);
              navigation.navigate('Home');
              simulationActions.start();
            }}
          />
          <ActionButton
            label={`Edit ${preset.name}`}
            onPress={() =>
              navigation.navigate('LocationDetails', { id: preset.id })
            }
          />
          <ActionButton
            label={`Delete ${preset.name}`}
            onPress={() =>
              Alert.alert('Delete location?', preset.name, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deletePreset(preset.id),
                },
              ])
            }
          />
        </View>
      ))}
      <ActionButton
        label="Create Location"
        onPress={() => navigation.navigate('LocationDetails')}
      />
    </Screen>
  );
}

export function SettingsScreen() {
  const { colors } = useTheme();
  const { settings, updateSettings } = useLocationStore();
  const fields = [
    'updateIntervalMs',
    'accuracy',
    'speedKmh',
    'altitude',
    'bearing',
    'radiusMeters',
    'durationSeconds',
  ] as const;
  const labels = {
    updateIntervalMs: 'Update interval (ms)',
    accuracy: 'Accuracy (m)',
    speedKmh: 'Speed (km/h)',
    altitude: 'Altitude (m)',
    bearing: 'Bearing (degrees)',
    radiusMeters: 'Radius (m)',
    durationSeconds: 'Duration (seconds, 0 = up to 24 hours)',
  };
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map(key => [key, String(settings[key])])),
  );
  const [loop, setLoop] = useState(settings.routeMode === 'loop');
  const [inclusive, setInclusive] = useState(settings.includeBoundary);
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <SectionTitle>Simulation Settings</SectionTitle>
      <ErrorMessage message={error} />
      {fields.map(key => (
        <Field
          key={key}
          label={labels[key]}
          numeric
          value={values[key]}
          onChange={value => setValues({ ...values, [key]: value })}
        />
      ))}
      <Text style={{ color: colors.text }}>Loop route</Text>
      <Switch
        accessibilityLabel="Loop route"
        value={loop}
        onValueChange={setLoop}
      />
      <Text style={{ color: colors.text }}>Include radius boundary</Text>
      <Switch
        accessibilityLabel="Include radius boundary"
        value={inclusive}
        onValueChange={setInclusive}
      />
      <ActionButton
        label="Save Settings"
        onPress={() => {
          try {
            const next = {
              ...settings,
              routeMode: loop ? 'loop' : 'once',
              includeBoundary: inclusive,
            } as SimulationSettings;
            fields.forEach(key => {
              next[key] = numberValue(values[key], labels[key]);
            });
            updateSettings(next);
            setError(null);
            Alert.alert(
              'Settings saved',
              'Changes apply to the next simulation.',
            );
          } catch (problem) {
            setError(String(problem));
          }
        }}
      />
    </Screen>
  );
}
