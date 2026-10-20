import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import {
  ActivityIndicator,
  AppState,
  StatusBar,
  useColorScheme,
} from 'react-native';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import {
  connectSimulation,
  refreshSimulation,
  useSimulationStore,
} from './src/store/useSimulationStore';
import { usePersistenceStatus } from './src/services/localStorage';

export default function App() {
  const isDark = useColorScheme() === 'dark';
  const ready = usePersistenceStatus(state => state.ready);
  useEffect(() => {
    let disposed = false;
    const disconnect = connectSimulation();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshSimulation(() => disposed).catch(error => {
          if (!disposed) {
            useSimulationStore.setState({ error: String(error) });
          }
        });
      }
    });
    return () => {
      disposed = true;
      disconnect();
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
        {ready ? (
          <RootNavigator />
        ) : (
          <ActivityIndicator accessibilityLabel="Loading saved locations" />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
