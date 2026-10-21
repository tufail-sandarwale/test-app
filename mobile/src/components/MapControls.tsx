import { useTheme } from '@react-navigation/native';
import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export const palette = {
  play: '#1B873F',
  stop: '#C62828',
  pin: '#D93025',
  favorite: '#F4B400',
  mock: '#1A73E8',
  route: '#C34919',
  target: '#007F68',
  real: '#5F5F5F',
  warningText: '#5C3B00',
  warningBackground: '#FFE8B3',
  errorText: '#FFFFFF',
  errorBackground: '#B3261E',
  infoText: '#FFFFFF',
  infoBackground: '#2D3B45',
};

export function useAccent() {
  return useTheme().dark ? '#86DBBC' : '#006C4C';
}

export type IconName =
  | 'menu'
  | 'play'
  | 'stop'
  | 'pause'
  | 'close'
  | 'plus'
  | 'search'
  | 'myLocation';

/** Icons drawn with views so the app needs no icon font or native rebuild. */
export function Icon({
  name,
  color,
  size = 22,
}: {
  name: IconName;
  color: string;
  size?: number;
}) {
  const bar = Math.max(2, Math.round(size / 9));
  const box = { width: size, height: size };
  switch (name) {
    case 'menu':
      return (
        <View style={[box, styles.menu]}>
          {[0, 1, 2].map(index => (
            <View
              key={index}
              style={{
                width: size * 0.8,
                height: bar,
                borderRadius: bar,
                backgroundColor: color,
              }}
            />
          ))}
        </View>
      );
    case 'play':
      return (
        <View style={[box, styles.center]}>
          <View
            style={[
              styles.triangle,
              {
                marginLeft: size * 0.15,
                borderLeftWidth: size * 0.7,
                borderTopWidth: size * 0.42,
                borderBottomWidth: size * 0.42,
                borderLeftColor: color,
              },
            ]}
          />
        </View>
      );
    case 'stop':
      return (
        <View style={[box, styles.center]}>
          <View
            style={{
              width: size * 0.62,
              height: size * 0.62,
              borderRadius: size * 0.08,
              backgroundColor: color,
            }}
          />
        </View>
      );
    case 'pause':
      return (
        <View style={[box, styles.center, styles.row, { gap: size * 0.2 }]}>
          {[0, 1].map(index => (
            <View
              key={index}
              style={[
                styles.pauseBar,
                {
                  width: size * 0.22,
                  height: size * 0.7,
                  backgroundColor: color,
                },
              ]}
            />
          ))}
        </View>
      );
    case 'close':
    case 'plus':
      return (
        <View style={[box, styles.center, name === 'close' && styles.rotated]}>
          <View
            style={[
              styles.absolute,
              { width: size * 0.8, height: bar, backgroundColor: color },
            ]}
          />
          <View
            style={[
              styles.absolute,
              { width: bar, height: size * 0.8, backgroundColor: color },
            ]}
          />
        </View>
      );
    case 'search':
      return (
        <View style={box}>
          <View
            style={{
              width: size * 0.62,
              height: size * 0.62,
              borderRadius: size,
              borderWidth: bar,
              borderColor: color,
            }}
          />
          <View
            style={[
              styles.absolute,
              styles.rotated,
              {
                right: size * 0.02,
                bottom: size * 0.12,
                width: size * 0.4,
                height: bar,
                borderRadius: bar,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      );
    case 'myLocation':
      return (
        <View style={[box, styles.center]}>
          <View
            style={[
              styles.center,
              {
                width: size * 0.64,
                height: size * 0.64,
                borderRadius: size,
                borderWidth: bar,
                borderColor: color,
              },
            ]}
          >
            <View
              style={{
                width: size * 0.24,
                height: size * 0.24,
                borderRadius: size,
                backgroundColor: color,
              }}
            />
          </View>
          {[
            { top: 0, width: bar, height: size * 0.2 },
            { bottom: 0, width: bar, height: size * 0.2 },
            { left: 0, width: size * 0.2, height: bar },
            { right: 0, width: size * 0.2, height: bar },
          ].map((tick, index) => (
            <View
              key={index}
              style={[styles.absolute, tick, { backgroundColor: color }]}
            />
          ))}
        </View>
      );
  }
}

type RoundButtonProps = PropsWithChildren<{
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  size?: number;
  backgroundColor?: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function RoundButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  size = 48,
  backgroundColor,
  selected,
  style,
  children,
}: RoundButtonProps) {
  const { colors } = useTheme();
  const accent = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy, selected }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.round,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: backgroundColor ?? colors.card,
          borderColor: selected ? accent : 'transparent',
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={accent} /> : children}
    </Pressable>
  );
}

export function Chip({
  label,
  onPress,
  selected = false,
  disabled = false,
  accessibilityLabel,
  tone = 'default',
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  tone?: 'default' | 'primary' | 'danger';
}) {
  const { colors } = useTheme();
  const accent = useAccent();
  const filled = selected || tone !== 'default';
  const fill =
    tone === 'danger'
      ? palette.stop
      : tone === 'primary'
      ? palette.mock
      : accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: filled ? fill : colors.border,
          backgroundColor: filled ? fill : colors.card,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.chipLabel,
          {
            color: filled
              ? selected && tone === 'default'
                ? colors.card
                : '#FFFFFF'
              : colors.text,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  menu: { justifyContent: 'space-evenly', alignItems: 'center' },
  pauseBar: { borderRadius: 2 },
  absolute: { position: 'absolute' },
  rotated: { transform: [{ rotate: '45deg' }] },
  triangle: {
    width: 0,
    height: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  round: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: { fontSize: 14, fontWeight: '600', letterSpacing: 0 },
});
