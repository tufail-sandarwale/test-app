import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  HomeScreen,
  LocationDetailsScreen,
  MapScreen,
  SavedLocationsScreen,
  SettingsScreen,
} from '../screens/PhaseOneScreens';
import { RoutesScreen } from '../screens/RoutesScreen';
import { CloudScreen } from '../screens/CloudScreen';

export type RootStackParamList = {
  Home: undefined;
  Map: undefined;
  LocationDetails: { id?: string } | undefined;
  SavedLocations: undefined;
  Settings: undefined;
  Routes: undefined;
  Cloud: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ animation: 'none', headerShadowVisible: false }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Mock GPS Tester' }}
      />
      <Stack.Screen
        name="Routes"
        component={RoutesScreen}
        options={{ title: 'Routes' }}
      />
      <Stack.Screen
        name="Map"
        component={MapScreen}
        options={{ title: 'Select Location' }}
      />
      <Stack.Screen
        name="LocationDetails"
        component={LocationDetailsScreen}
        options={{ title: 'Location Details' }}
      />
      <Stack.Screen
        name="SavedLocations"
        component={SavedLocationsScreen}
        options={{ title: 'Saved Locations' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Simulation Settings' }}
      />
      <Stack.Screen
        name="Cloud"
        component={CloudScreen}
        options={{ title: 'Cloud Presets' }}
      />
    </Stack.Navigator>
  );
}
