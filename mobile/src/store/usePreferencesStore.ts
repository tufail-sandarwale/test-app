import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { localStorage } from '../services/localStorage';
import { mapStyles, type MapStyleId } from '../utils/mapStyles';

export const joystickSpeeds = [
  { label: 'Walk', speedKmh: 5 },
  { label: 'Run', speedKmh: 10 },
  { label: 'Bike', speedKmh: 20 },
  { label: 'Car', speedKmh: 60 },
] as const;

interface PreferencesState {
  mapStyle: MapStyleId;
  joystickSpeedKmh: number;
  setMapStyle: (mapStyle: MapStyleId) => void;
  setJoystickSpeed: (speedKmh: number) => void;
}

const validStyle = (value: unknown): value is MapStyleId =>
  mapStyles.some(option => option.id === value);

const validSpeed = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= 1080;

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    set => ({
      mapStyle: 'streets',
      joystickSpeedKmh: 5,
      setMapStyle: mapStyle => {
        if (!validStyle(mapStyle)) {
          throw new Error('Unknown map style.');
        }
        set({ mapStyle });
      },
      setJoystickSpeed: speedKmh => {
        if (!validSpeed(speedKmh)) {
          throw new Error(
            'Joystick speed must be above 0 and at most 1080 km/h.',
          );
        }
        set({ joystickSpeedKmh: speedKmh });
      },
    }),
    {
      name: 'mock-gps-preferences-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Preferences are cosmetic, so invalid saved values fall back to defaults.
      merge: (persisted, current) => {
        const data = (persisted ?? {}) as Partial<PreferencesState>;
        return {
          ...current,
          mapStyle: validStyle(data.mapStyle)
            ? data.mapStyle
            : current.mapStyle,
          joystickSpeedKmh: validSpeed(data.joystickSpeedKmh)
            ? data.joystickSpeedKmh
            : current.joystickSpeedKmh,
        };
      },
      partialize: state => ({
        mapStyle: state.mapStyle,
        joystickSpeedKmh: state.joystickSpeedKmh,
      }),
    },
  ),
);
