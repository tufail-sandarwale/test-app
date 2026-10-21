import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  AppState,
  PanResponder,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import {
  clampToRadius,
  createSteeringController,
  vectorToSteering,
} from '../utils/joystick';
import { palette } from './MapControls';

type Props = {
  maxSpeedKmh: number;
  mapBearing: number;
  onSteer: (bearing: number, speedMetersPerSecond: number) => void;
  size?: number;
};

const directions: Record<string, number> = {
  north: 0,
  east: 90,
  south: 180,
  west: 270,
};

export function Joystick({
  maxSpeedKmh,
  mapBearing,
  onSteer,
  size = 140,
}: Props) {
  const { colors } = useTheme();
  const radius = size / 2;
  const knob = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const latest = useRef({ maxSpeedKmh, mapBearing, onSteer, radius });
  latest.current = { maxSpeedKmh, mapBearing, onSteer, radius };
  const holding = useRef(false);
  const controller = useMemo(
    () =>
      createSteeringController((bearing, speed) =>
        latest.current.onSteer(bearing, speed),
      ),
    [],
  );

  const release = () => {
    if (holding.current) {
      holding.current = false;
      controller.release();
    }
    Animated.spring(knob, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          holding.current = true;
        },
        onPanResponderMove: (_event, gesture) => {
          const current = latest.current;
          const offset = clampToRadius(gesture.dx, gesture.dy, current.radius);
          knob.setValue(offset);
          holding.current = true;
          controller.update(
            vectorToSteering(
              offset.x,
              offset.y,
              current.radius,
              current.maxSpeedKmh,
              current.mapBearing,
            ),
          );
        },
        onPanResponderRelease: () => releaseRef.current(),
        onPanResponderTerminate: () => releaseRef.current(),
      }),
    [controller, knob],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        releaseRef.current();
      }
    });
    return () => {
      subscription.remove();
      if (holding.current) {
        controller.release();
      }
      controller.dispose();
    };
  }, [controller]);

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const name = event.nativeEvent.actionName;
    if (name === 'stop') {
      holding.current = true;
      release();
      return;
    }
    if (name in directions) {
      holding.current = true;
      controller.update({
        bearing: directions[name],
        speedMetersPerSecond: maxSpeedKmh / 3.6,
      });
    }
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Joystick"
      accessibilityHint="Drag to move the mocked location. Use actions to move north, east, south or west, or stop."
      accessibilityActions={[
        { name: 'north', label: 'Move north' },
        { name: 'east', label: 'Move east' },
        { name: 'south', label: 'Move south' },
        { name: 'west', label: 'Move west' },
        { name: 'stop', label: 'Stop moving' },
      ]}
      onAccessibilityAction={onAccessibilityAction}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
      ]}
      {...responder.panHandlers}
    >
      <View style={[styles.ring, { borderColor: colors.border }]} />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.knob,
          {
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: size * 0.2,
            transform: knob.getTranslateTransform(),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    opacity: 0.92,
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  ring: {
    position: 'absolute',
    width: '62%',
    height: '62%',
    borderRadius: 999,
    borderWidth: 1,
  },
  knob: {
    backgroundColor: palette.mock,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
});
