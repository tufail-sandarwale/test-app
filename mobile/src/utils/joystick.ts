import { normalizeBearing } from './geo';

export const JOYSTICK_DEAD_ZONE = 0.15;

export interface Steering {
  bearing: number;
  speedMetersPerSecond: number;
}

/**
 * Converts a joystick offset in screen pixels into a compass bearing and speed.
 * Up on screen is the map's current bearing, so rotated maps still steer naturally.
 */
export function vectorToSteering(
  dx: number,
  dy: number,
  radius: number,
  maxSpeedKmh: number,
  mapBearing = 0,
): Steering {
  const fraction = Math.min(Math.hypot(dx, dy) / radius, 1);
  if (!Number.isFinite(fraction) || fraction < JOYSTICK_DEAD_ZONE) {
    return { bearing: normalizeBearing(mapBearing), speedMetersPerSecond: 0 };
  }
  const screenBearing = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return {
    bearing: normalizeBearing(screenBearing + mapBearing),
    speedMetersPerSecond: (fraction * maxSpeedKmh) / 3.6,
  };
}

/** Clamps a joystick knob offset to the base radius. */
export function clampToRadius(dx: number, dy: number, radius: number) {
  const distance = Math.hypot(dx, dy);
  if (distance <= radius || distance === 0) {
    return { x: dx, y: dy };
  }
  return { x: (dx / distance) * radius, y: (dy / distance) * radius };
}

/**
 * Throttles joystick updates and repeats the last command while the stick is held,
 * so the native steering timeout only stops movement when updates really stop.
 */
export function createSteeringController(
  send: (bearing: number, speedMetersPerSecond: number) => void,
  throttleMs = 150,
  keepAliveMs = 1000,
) {
  let latest: Steering | null = null;
  let lastSentAt = -Infinity;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const transmit = () => {
    pending = null;
    if (latest) {
      lastSentAt = Date.now();
      send(latest.bearing, latest.speedMetersPerSecond);
    }
  };
  const stopKeepAlive = () => {
    if (keepAlive) {
      clearInterval(keepAlive);
      keepAlive = null;
    }
  };
  const cancelPending = () => {
    if (pending) {
      clearTimeout(pending);
      pending = null;
    }
  };

  return {
    update(steering: Steering) {
      latest = steering;
      if (steering.speedMetersPerSecond > 0 && !keepAlive) {
        keepAlive = setInterval(transmit, keepAliveMs);
      } else if (steering.speedMetersPerSecond === 0) {
        stopKeepAlive();
      }
      if (!pending) {
        pending = setTimeout(
          transmit,
          Math.max(0, throttleMs - (Date.now() - lastSentAt)),
        );
      }
    },
    release() {
      cancelPending();
      stopKeepAlive();
      latest = { bearing: latest?.bearing ?? 0, speedMetersPerSecond: 0 };
      transmit();
    },
    dispose() {
      cancelPending();
      stopKeepAlive();
    },
  };
}
