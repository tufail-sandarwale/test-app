import type { LocationConfig } from '../types/location';
import { numberValue, validateLocation } from '../utils/validation';
import { useLocationStore } from '../store/useLocationStore';

export type LocationDraft = Record<keyof LocationConfig, string> & {
  name: string;
};

export function locationDraft(id?: string): LocationDraft {
  const { presets, selected, settings } = useLocationStore.getState();
  const preset = presets.find(item => item.id === id);
  const coordinate = preset ?? selected;
  return {
    name: preset?.name ?? '',
    latitude: coordinate ? String(coordinate.latitude) : '',
    longitude: coordinate ? String(coordinate.longitude) : '',
    accuracy: String(preset?.accuracy ?? settings.accuracy),
    altitude: String(preset?.altitude ?? settings.altitude),
    bearing: String(preset?.bearing ?? settings.bearing),
    speed: String(preset?.speed ?? settings.speedKmh / 3.6),
  };
}

export function applyLocationDraft(
  draft: LocationDraft,
  save: boolean,
  id?: string,
) {
  const location: LocationConfig = {
    latitude: numberValue(draft.latitude, 'Latitude'),
    longitude: numberValue(draft.longitude, 'Longitude'),
    accuracy: numberValue(draft.accuracy, 'Accuracy'),
    altitude: numberValue(draft.altitude, 'Altitude'),
    bearing: numberValue(draft.bearing, 'Bearing'),
    speed: numberValue(draft.speed, 'Speed'),
  };
  validateLocation(location);
  const store = useLocationStore.getState();
  if (save) {
    store.savePreset(draft.name, location, id);
  }
  store.select(location);
  store.updateSettings({
    ...store.settings,
    accuracy: location.accuracy,
    altitude: location.altitude,
    bearing: location.bearing,
    speedKmh: location.speed * 3.6,
  });
}
