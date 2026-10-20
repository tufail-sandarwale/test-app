import { useState } from 'react';
import { Alert, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen, SectionTitle, Reading } from '../components/Screen';
import { Field, ErrorMessage } from '../components/Field';
import { ActionButton } from '../components/ActionButton';
import { useLocationStore } from '../store/useLocationStore';
import { simulationActions } from '../store/useSimulationStore';
import type { RootStackParamList } from '../navigation/RootNavigator';

export function RoutesScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Routes'>) {
  const {
    route,
    savedRoutes,
    replaceRoute,
    saveRoute,
    deleteRoute,
    selectRoute,
  } = useLocationStore();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <SectionTitle>Route Waypoints</SectionTitle>
      <ErrorMessage message={error} />
      <Field label="Route name" value={name} onChange={setName} />
      {route.map((point, index) => (
        <View key={`${index}-${point.latitude}-${point.longitude}`}>
          <Reading
            label={`Waypoint ${index + 1}`}
            value={`${point.latitude.toFixed(6)}, ${point.longitude.toFixed(
              6,
            )}`}
          />
          <ActionButton
            label={`Remove waypoint ${index + 1}`}
            onPress={() =>
              replaceRoute(route.filter((_point, offset) => offset !== index))
            }
          />
        </View>
      ))}
      <ActionButton
        label="Add Waypoints on Map"
        onPress={() => navigation.navigate('Map')}
      />
      <ActionButton
        label="Save Route"
        disabled={route.length < 2}
        onPress={() => {
          try {
            saveRoute(name, editingId);
            setEditingId(undefined);
            setName('');
            setError(null);
          } catch (problem) {
            setError(String(problem));
          }
        }}
      />
      <ActionButton
        label="Start Route"
        disabled={route.length < 2}
        onPress={() => {
          navigation.navigate('Home');
          simulationActions.startRoute();
        }}
      />
      <ActionButton
        label="Clear Waypoints"
        disabled={!route.length}
        onPress={() =>
          Alert.alert('Clear waypoints?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear',
              style: 'destructive',
              onPress: () => {
                replaceRoute([]);
                setEditingId(undefined);
              },
            },
          ])
        }
      />
      <SectionTitle>Saved Routes</SectionTitle>
      {savedRoutes.map(saved => (
        <View key={saved.id}>
          <Reading
            label={saved.name}
            value={`${saved.points.length} waypoints`}
          />
          <ActionButton
            label={`Select ${saved.name}`}
            onPress={() => {
              selectRoute(saved.id);
              setName(saved.name);
              setEditingId(saved.id);
            }}
          />
          <ActionButton
            label={`Start ${saved.name}`}
            onPress={() => {
              selectRoute(saved.id);
              navigation.navigate('Home');
              simulationActions.startRoute();
            }}
          />
          <ActionButton
            label={`Delete ${saved.name}`}
            onPress={() =>
              Alert.alert('Delete route?', saved.name, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deleteRoute(saved.id);
                    if (editingId === saved.id) {
                      setEditingId(undefined);
                    }
                  },
                },
              ])
            }
          />
        </View>
      ))}
    </Screen>
  );
}
