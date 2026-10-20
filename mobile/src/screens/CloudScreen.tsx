import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Screen, SectionTitle } from '../components/Screen';
import { ActionButton } from '../components/ActionButton';
import { Field, ErrorMessage } from '../components/Field';
import { cloudActions, useCloudStore } from '../services/cloud';
import { useLocationStore } from '../store/useLocationStore';

export function CloudScreen() {
  const { colors } = useTheme();
  const { connected, busy, error, message, locations, routes, run } =
    useCloudStore();
  const { presets, savedRoutes } = useLocationStore();
  const [url, setURL] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const authenticate = (register: boolean) =>
    run(async () => {
      try {
        await cloudActions.authenticate(url, email, password, register);
      } finally {
        setPassword('');
      }
    });
  return (
    <Screen>
      <SectionTitle>Cloud Presets</SectionTitle>
      <ErrorMessage message={error} />
      {message && (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {message}
        </Text>
      )}
      {!connected ? (
        <>
          <Field label="Server URL" value={url} onChange={setURL} />
          <Field label="Email" value={email} onChange={setEmail} />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            secure
          />
          <ActionButton
            label="Sign In"
            disabled={busy}
            onPress={() => authenticate(false)}
          />
          <ActionButton
            label="Create Account"
            disabled={busy}
            onPress={() => authenticate(true)}
          />
        </>
      ) : (
        <>
          <ActionButton
            label="Refresh Cloud Presets"
            disabled={busy}
            onPress={() => run(cloudActions.refresh)}
          />
          <ActionButton
            label="Sign Out"
            disabled={busy}
            onPress={cloudActions.logout}
          />
          {(['locations', 'routes'] as const).map(resource => (
            <View key={resource}>
              <SectionTitle>
                {resource === 'locations' ? 'Cloud Locations' : 'Cloud Routes'}
              </SectionTitle>
              {(resource === 'locations' ? locations : routes).length === 0 && (
                <Text style={{ color: colors.text }}>No cloud presets.</Text>
              )}
              {(resource === 'locations' ? locations : routes).map(item => (
                <View key={item.id}>
                  <Text style={{ color: colors.text }}>{item.name}</Text>
                  <ActionButton
                    label={`Download ${item.name}`}
                    disabled={busy}
                    onPress={() =>
                      run(() => cloudActions.download(resource, item))
                    }
                  />
                  <ActionButton
                    label={`Delete Cloud ${item.name}`}
                    disabled={busy}
                    onPress={() =>
                      Alert.alert('Delete cloud preset?', item.name, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () =>
                            run(() => cloudActions.remove(resource, item.id)),
                        },
                      ])
                    }
                  />
                </View>
              ))}
              {useCloudStore.getState()[resource].length >= 100 && (
                <ActionButton
                  label={`Load More ${resource}`}
                  disabled={busy}
                  onPress={() => run(() => cloudActions.loadMore(resource))}
                />
              )}
            </View>
          ))}
          <SectionTitle>Local Locations</SectionTitle>
          {presets.length === 0 && (
            <Text style={{ color: colors.text }}>No saved locations.</Text>
          )}
          {presets.map(item => (
            <ActionButton
              key={item.id}
              label={`Upload ${item.name}`}
              disabled={busy}
              onPress={() => run(() => cloudActions.upload('locations', item))}
            />
          ))}
          <SectionTitle>Local Routes</SectionTitle>
          {savedRoutes.length === 0 && (
            <Text style={{ color: colors.text }}>No saved routes.</Text>
          )}
          {savedRoutes.map(item => (
            <ActionButton
              key={item.id}
              label={`Upload ${item.name}`}
              disabled={busy}
              onPress={() => run(() => cloudActions.upload('routes', item))}
            />
          ))}
        </>
      )}
    </Screen>
  );
}
