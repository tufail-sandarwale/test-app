import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import {
  ActivityIndicator,
  AppState,
  StatusBar,
  StyleSheet,
  Text,
  View,
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
import {
  clearCrashReport,
  loadCrashReport,
  useDiagnosticsStore,
} from './src/services/diagnostics';
import {
  CrashReportNotice,
  ErrorBoundary,
  ErrorScreen,
} from './src/components/ErrorBoundary';

export const STARTUP_TIMEOUT_MS = 8000;

export default function App() {
  return (
    <ErrorBoundary
      renderFallback={(report, reset) => (
        <ErrorScreen
          title="Something went wrong"
          report={report}
          onRetry={reset}
        />
      )}
    >
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? DarkTheme : DefaultTheme;
  const ready = usePersistenceStatus(state => state.ready);
  const { fatalError, crashReport } = useDiagnosticsStore();
  useEffect(() => {
    let disposed = false;
    const disconnect = connectSimulation();
    loadCrashReport();
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

  // Never leave the user on a loading screen if saved data cannot be read.
  useEffect(() => {
    if (ready) {
      return;
    }
    const timer = setTimeout(() => {
      if (!usePersistenceStatus.getState().ready) {
        usePersistenceStatus.setState({
          ready: true,
          error:
            'Saved data is taking too long to load. You can keep using the app; restart it if saved places are missing.',
        });
      }
    }, STARTUP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  if (fatalError) {
    return (
      <ErrorScreen
        title="Something went wrong"
        report={fatalError}
        onRetry={() => useDiagnosticsStore.setState({ fatalError: null })}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={theme}>
        {ready ? (
          <RootNavigator />
        ) : (
          <View
            style={[
              styles.loading,
              { backgroundColor: theme.colors.background },
            ]}
          >
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              accessibilityLabel="Loading saved locations"
            />
            <Text style={[styles.loadingText, { color: theme.colors.text }]}>
              Loading saved places…
            </Text>
          </View>
        )}
      </NavigationContainer>
      <CrashReportNotice report={crashReport} onDismiss={clearCrashReport} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: { fontSize: 16 },
});
