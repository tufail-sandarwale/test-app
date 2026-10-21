import { StyleSheet, View } from 'react-native';
import { palette } from './MapControls';

const HEAD = 30;
const STEM = 12;

/** Fixed pin whose tip marks the map center, like a classic GPS emulator picker. */
export function CrosshairPin({ lifted = false }: { lifted?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={styles.overlay}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.shadow} />
      <View
        style={[
          styles.pin,
          {
            transform: [{ translateY: -(HEAD + STEM) / 2 - (lifted ? 8 : 0) }],
          },
        ]}
      >
        <View style={styles.head}>
          <View style={styles.dot} />
        </View>
        <View style={styles.stem} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: { alignItems: 'center', height: HEAD + STEM, position: 'absolute' },
  head: {
    width: HEAD,
    height: HEAD,
    borderRadius: HEAD / 2,
    backgroundColor: palette.pin,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  stem: {
    width: 0,
    height: 0,
    marginTop: -3,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: STEM + 3,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: palette.pin,
  },
  shadow: {
    position: 'absolute',
    width: 10,
    height: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
