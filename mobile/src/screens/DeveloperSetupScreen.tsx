import { useCallback, useEffect } from 'react';
import { Alert, AppState, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import { ActionButton } from '../components/ActionButton';
import { ErrorMessage } from '../components/Field';
import { Reading, Screen, SectionTitle } from '../components/Screen';
import { nativeLocation } from '../services/MockLocation';
import { isReady, setupActions, useSetupStore } from '../store/useSetupStore';
import { useSimulationStore } from '../store/useSimulationStore';

function Hint({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.hint, { color: colors.text }]}>{children}</Text>;
}

const state = (value: boolean | undefined, on: string, off: string) =>
  value === undefined ? 'Checking…' : value ? on : off;

export function DeveloperSetupScreen() {
  const { prerequisites: status, busy, error, message } = useSetupStore();
  const simulationActive = useSimulationStore(store =>
    ['starting', 'running', 'paused'].includes(store.status.state),
  );

  useFocusEffect(
    useCallback(() => {
      if (nativeLocation) {
        setupActions.refresh();
      }
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && nativeLocation) {
        setupActions.refresh();
      }
    });
    return () => subscription.remove();
  }, []);

  if (!nativeLocation) {
    return (
      <Screen>
        <SectionTitle>Device Setup</SectionTitle>
        <ErrorMessage message="Native location module unavailable. Install the latest Android APK." />
      </Screen>
    );
  }

  const developerOn = status?.developerOptionsEnabled;
  return (
    <Screen>
      <SectionTitle>Device Setup</SectionTitle>
      <ErrorMessage message={error} />
      {message && <Hint>{message}</Hint>}
      <Reading
        label="Overall"
        value={
          status
            ? isReady(status)
              ? 'READY TO SIMULATE'
              : 'ACTION NEEDED'
            : 'Checking…'
        }
      />
      <Hint>
        Android only lets you change these settings yourself. Each button opens
        the right Settings screen; come back here and the status updates.
      </Hint>

      <SectionTitle>1. Developer Options</SectionTitle>
      <Reading
        label="Developer Options"
        value={state(developerOn, 'Enabled', 'Disabled')}
      />
      {developerOn === false && (
        <>
          <Hint>
            Open About phone (on some phones: Software information) and tap
            Build number 7 times, then enter your PIN if asked.
          </Hint>
          <ActionButton
            label="Enable Developer Options"
            disabled={busy}
            onPress={() => setupActions.openSettings('about')}
          />
        </>
      )}
      {developerOn && (
        <>
          <ActionButton
            label="Open Developer Options"
            disabled={busy}
            onPress={() => setupActions.openSettings('developer')}
          />
          <ActionButton
            label="Disable Developer Options"
            disabled={busy || simulationActive}
            onPress={() =>
              Alert.alert(
                'Disable Developer Options?',
                'Turn off the switch at the top of Developer Options. This also removes the mock location app selection, so simulation will stop working until you enable it again.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Open Developer Options',
                    onPress: () => setupActions.openSettings('developer'),
                  },
                ],
              )
            }
          />
          {simulationActive && (
            <Hint>Stop the simulation before disabling Developer Options.</Hint>
          )}
        </>
      )}

      <SectionTitle>2. Mock location app</SectionTitle>
      <Reading
        label="Mock location app"
        value={state(
          status?.mockAppSelected,
          'Mock GPS Tester selected',
          'Not selected',
        )}
      />
      {status && !status.mockAppSelected && (
        <>
          <Hint>
            In Developer Options, tap Select mock location app and choose Mock
            GPS Tester.
          </Hint>
          <ActionButton
            label="Select Mock Location App"
            disabled={busy || !developerOn}
            onPress={() => setupActions.openSettings('developer')}
          />
        </>
      )}

      <SectionTitle>3. Precise location permission</SectionTitle>
      <Reading
        label="Precise location"
        value={state(status?.permissionGranted, 'Granted', 'Not granted')}
      />
      {status && !status.permissionGranted && (
        <>
          <ActionButton
            label="Grant Location Permission"
            disabled={busy}
            onPress={setupActions.requestLocation}
          />
          <ActionButton
            label="Open App Settings"
            disabled={busy}
            onPress={() => setupActions.openSettings('app')}
          />
        </>
      )}

      <SectionTitle>4. Location services</SectionTitle>
      <Reading
        label="Device location"
        value={state(status?.locationEnabled, 'On', 'Off')}
      />
      {status && !status.locationEnabled && (
        <ActionButton
          label="Open Location Settings"
          disabled={busy}
          onPress={() => setupActions.openSettings('location')}
        />
      )}

      <SectionTitle>5. Notifications (recommended)</SectionTitle>
      <Reading
        label="Notifications"
        value={state(status?.notificationsEnabled, 'Allowed', 'Blocked')}
      />
      {status && !status.notificationsEnabled && (
        <>
          <Hint>
            Allows the pause and stop controls in the notification while
            simulating.
          </Hint>
          <ActionButton
            label="Allow Notifications"
            disabled={busy}
            onPress={setupActions.requestNotifications}
          />
        </>
      )}

      <ActionButton
        label="Refresh Status"
        disabled={busy}
        onPress={setupActions.refresh}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 15, lineHeight: 22, opacity: 0.85 },
});
