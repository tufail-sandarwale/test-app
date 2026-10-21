import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  LocationDetailsScreen,
  SavedLocationsScreen,
  SettingsScreen,
  StatusScreen,
} from '../screens/PhaseOneScreens';
import { EmulatorScreen } from '../screens/EmulatorScreen';
import { RoutesScreen } from '../screens/RoutesScreen';
import { CloudScreen } from '../screens/CloudScreen';
import { DeveloperSetupScreen } from '../screens/DeveloperSetupScreen';
import type { EmulatorMode } from '../types/location';

export type RootStackParamList = {
  Home: { mode?: EmulatorMode } | undefined;
  Status: undefined;
  LocationDetails: { id?: string } | undefined;
  SavedLocations: undefined;
  Settings: undefined;
  Routes: undefined;
  Cloud: undefined;
  DeveloperSetup: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ animation: 'none', headerShadowVisible: false }}
    >
      <Stack.Screen
        name="Home"
        component={EmulatorScreen}
        options={{ title: 'Mock GPS Tester', headerShown: false }}
      />
      <Stack.Screen
        name="Status"
        component={StatusScreen}
        options={{ title: 'Simulation Status' }}
      />
      <Stack.Screen
        name="Routes"
        component={RoutesScreen}
        options={{ title: 'Saved Routes' }}
      />
      <Stack.Screen
        name="LocationDetails"
        component={LocationDetailsScreen}
        options={{ title: 'Location Details' }}
      />
      <Stack.Screen
        name="SavedLocations"
        component={SavedLocationsScreen}
        options={{ title: 'Favorites' }}
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
      <Stack.Screen
        name="DeveloperSetup"
        component={DeveloperSetupScreen}
        options={{ title: 'Device Setup' }}
      />
    </Stack.Navigator>
  );
}
