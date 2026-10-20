import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  Alert,
  ScrollView,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Map,
  Camera,
  ViewAnnotation,
  GeoJSONSource,
  Layer,
} from '@maplibre/maplibre-react-native';
import { circle } from '@turf/circle';
import { lineString } from '@turf/helpers';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../components/ActionButton';
import { useLocationStore } from '../store/useLocationStore';
import { distanceMeters, position } from '../utils/geo';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useSimulationStore } from '../store/useSimulationStore';

export function MapScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Map'>) {
  const { colors } = useTheme();
  const { selected, target, settings, route, select, setTarget, addWaypoint } =
    useLocationStore();
  const { realLocation, status } = useSimulationStore();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (loaded) {
      return;
    }
    const timeout = setTimeout(() => {
      setFailed(true);
      setLoaded(true);
    }, 15000);
    return () => clearTimeout(timeout);
  }, [loaded, revision]);
  const choose = (lngLat: [number, number]) => {
    try {
      select({ latitude: lngLat[1], longitude: lngLat[0] });
    } catch (error) {
      Alert.alert('Invalid location', String(error));
    }
  };
  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Map
        key={revision}
        style={styles.map}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        onPress={event => choose(event.nativeEvent.lngLat)}
        onDidFinishLoadingMap={() => {
          setLoaded(true);
          setFailed(false);
        }}
        onDidFailLoadingMap={() => {
          setFailed(true);
          setLoaded(true);
        }}
      >
        <Camera
          initialViewState={{
            center: position(
              selected ?? { latitude: 19.076, longitude: 72.8777 },
            ),
            zoom: 14,
          }}
        />
        {target && (
          <GeoJSONSource
            id="radius"
            data={circle(position(target), settings.radiusMeters, {
              units: 'meters',
              steps: 96,
            })}
          >
            <Layer
              id="radius-fill"
              type="fill"
              paint={{ 'fill-color': '#007F68', 'fill-opacity': 0.15 }}
            />
            <Layer
              id="radius-line"
              type="line"
              paint={{ 'line-color': '#007F68', 'line-width': 2 }}
            />
          </GeoJSONSource>
        )}
        {route.length > 1 && (
          <GeoJSONSource
            id="route"
            data={lineString(
              (settings.routeMode === 'loop'
                ? [...route, route[0]]
                : route
              ).map(position),
            )}
          >
            <Layer
              id="route-line"
              type="line"
              paint={{ 'line-color': '#C34919', 'line-width': 3 }}
            />
          </GeoJSONSource>
        )}
        {target && (
          <ViewAnnotation id="target" lngLat={position(target)} title="Target">
            <View style={[styles.marker, styles.target]}>
              <Text style={styles.markerLabel}>T</Text>
            </View>
          </ViewAnnotation>
        )}
        {selected && (
          <ViewAnnotation
            id="selected"
            lngLat={position(selected)}
            title="Selected location"
            draggable
            onDragEnd={event => choose(event.nativeEvent.lngLat)}
          >
            <View style={[styles.marker, styles.selected]}>
              <Text style={styles.markerLabel}>S</Text>
            </View>
          </ViewAnnotation>
        )}
        {realLocation && (
          <ViewAnnotation
            id="real"
            lngLat={position(realLocation)}
            title="Captured real location"
          >
            <View style={[styles.marker, styles.real]}>
              <Text style={styles.markerLabel}>R</Text>
            </View>
          </ViewAnnotation>
        )}
        {status.location && (
          <ViewAnnotation
            id="simulated"
            lngLat={position(status.location)}
            title="Last simulated location"
          >
            <View style={[styles.marker, styles.simulated]}>
              <Text style={styles.markerLabel}>M</Text>
            </View>
          </ViewAnnotation>
        )}
      </Map>
      {!loaded && <ActivityIndicator accessibilityLabel="Loading map" />}
      <ScrollView
        style={styles.controlsViewport}
        contentContainerStyle={styles.controls}
      >
        {failed && (
          <>
            <Text accessibilityRole="alert" style={{ color: colors.text }}>
              Map unavailable. Check your connection or enter coordinates
              manually.
            </Text>
            <ActionButton
              label="Retry Map"
              onPress={() => {
                setFailed(false);
                setLoaded(false);
                setRevision(revision + 1);
              }}
            />
          </>
        )}
        <Text style={{ color: colors.text }}>
          {selected
            ? `${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(
                6,
              )}`
            : 'No location selected'}
        </Text>
        {target && selected && (
          <Text style={{ color: colors.text }}>
            Distance: {distanceMeters(target, selected).toFixed(1)} m
          </Text>
        )}
        <View style={styles.row}>
          <ActionButton
            label="Set Target"
            disabled={!selected}
            onPress={() => selected && setTarget(selected)}
          />
          <ActionButton
            label={`Add Waypoint (${route.length})`}
            disabled={!selected}
            onPress={() => {
              try {
                if (selected) {
                  addWaypoint(selected);
                }
              } catch (error) {
                Alert.alert('Route', String(error));
              }
            }}
          />
        </View>
        <ActionButton
          label="Enter Location Details"
          onPress={() => navigation.navigate('LocationDetails')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1, minHeight: 160 },
  controlsViewport: { maxHeight: '45%', flexGrow: 0 },
  controls: { padding: 12, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: '#245AC8' },
  target: { backgroundColor: '#007F68' },
  real: { backgroundColor: '#5F5F5F' },
  simulated: { backgroundColor: '#C34919' },
  markerLabel: { color: '#FFFFFF', fontWeight: '700' },
});
