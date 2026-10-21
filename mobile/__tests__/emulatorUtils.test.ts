import {
  clampToRadius,
  createSteeringController,
  vectorToSteering,
} from '../src/utils/joystick';
import {
  MIN_SEARCH_INTERVAL_MS,
  parseCoordinates,
  resetSearchThrottle,
  searchPlaces,
} from '../src/services/geocoding';
import { fromPosition, routeLengthMeters } from '../src/utils/geo';

describe('joystick', () => {
  test('screen directions map to compass bearings and speed scales with deflection', () => {
    expect(vectorToSteering(0, -50, 50, 36)).toEqual({
      bearing: 0,
      speedMetersPerSecond: 10,
    });
    expect(vectorToSteering(25, 0, 50, 36).bearing).toBeCloseTo(90);
    expect(vectorToSteering(25, 0, 50, 36).speedMetersPerSecond).toBeCloseTo(5);
    expect(vectorToSteering(0, 80, 50, 36)).toEqual({
      bearing: 180,
      speedMetersPerSecond: 10,
    });
    expect(vectorToSteering(-50, 0, 50, 36).bearing).toBeCloseTo(270);
  });

  test('rotated maps steer relative to the screen and the dead zone stops', () => {
    expect(vectorToSteering(0, -50, 50, 36, 90).bearing).toBeCloseTo(90);
    expect(vectorToSteering(-50, 0, 50, 36, 120).bearing).toBeCloseTo(30);
    expect(vectorToSteering(3, 3, 50, 36).speedMetersPerSecond).toBe(0);
  });

  test('the knob is clamped to the base', () => {
    expect(clampToRadius(30, 40, 25)).toEqual({ x: 15, y: 20 });
    expect(clampToRadius(3, 4, 25)).toEqual({ x: 3, y: 4 });
  });

  test('updates are throttled, repeated while held and stopped on release', () => {
    jest.useFakeTimers();
    try {
      const send = jest.fn();
      const controller = createSteeringController(send, 150, 1000);
      controller.update({ bearing: 10, speedMetersPerSecond: 2 });
      controller.update({ bearing: 20, speedMetersPerSecond: 2 });
      jest.advanceTimersByTime(0);
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenLastCalledWith(20, 2);
      controller.update({ bearing: 30, speedMetersPerSecond: 3 });
      jest.advanceTimersByTime(100);
      expect(send).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(50);
      expect(send).toHaveBeenLastCalledWith(30, 3);
      const before = send.mock.calls.length;
      jest.advanceTimersByTime(2000);
      expect(send.mock.calls.length).toBeGreaterThanOrEqual(before + 2);
      controller.release();
      expect(send).toHaveBeenLastCalledWith(30, 0);
      const released = send.mock.calls.length;
      jest.advanceTimersByTime(5000);
      expect(send).toHaveBeenCalledTimes(released);
      controller.dispose();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('geocoding', () => {
  beforeEach(() => resetSearchThrottle());

  test('parses decimal coordinates in common formats', () => {
    expect(parseCoordinates('19.076, 72.8777')).toEqual({
      latitude: 19.076,
      longitude: 72.8777,
    });
    expect(parseCoordinates(' -33.86 151.21 ')).toEqual({
      latitude: -33.86,
      longitude: 151.21,
    });
    expect(parseCoordinates('48.85;2.35')).toEqual({
      latitude: 48.85,
      longitude: 2.35,
    });
    expect(parseCoordinates('91, 0')).toBeNull();
    expect(parseCoordinates('0, 181')).toBeNull();
    expect(parseCoordinates('Mumbai')).toBeNull();
  });

  test('searches Nominatim with an identifying user agent and drops invalid results', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          place_id: 1,
          display_name: 'Pune, Maharashtra',
          lat: '18.52',
          lon: '73.85',
        },
        { place_id: 2, name: 'Broken', lat: 'x', lon: '0' },
      ],
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const places = await searchPlaces('  Pune ');
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=Pune',
    );
    expect(fetchSpy.mock.calls[0][1].headers['User-Agent']).toMatch(
      /^MockGPSTester\//,
    );
    expect(places).toEqual([
      {
        id: '1',
        name: 'Pune',
        address: 'Pune, Maharashtra',
        latitude: 18.52,
        longitude: 73.85,
      },
    ]);
  });

  test('reports HTTP, rate limit and network failures', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    await expect(searchPlaces('a')).rejects.toThrow('HTTP 500');
    resetSearchThrottle();
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;
    await expect(searchPlaces('a')).rejects.toThrow('Too many searches');
    resetSearchThrottle();
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('Network')) as unknown as typeof fetch;
    await expect(searchPlaces('a')).rejects.toThrow('Search is unavailable');
    expect(await searchPlaces('   ')).toEqual([]);
  });

  test('consecutive searches respect the one request per second policy', async () => {
    jest.useFakeTimers();
    try {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;
      await searchPlaces('first');
      const second = searchPlaces('second');
      await Promise.resolve();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(MIN_SEARCH_INTERVAL_MS);
      await second;
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('map geometry helpers', () => {
  test('map positions keep exact in-range values and wrap the antimeridian', () => {
    expect(fromPosition([72.6, 19.6])).toEqual({
      latitude: 19.6,
      longitude: 72.6,
    });
    expect(fromPosition([190, 10]).longitude).toBeCloseTo(-170);
    expect(fromPosition([-190, 95])).toEqual({
      latitude: 90,
      longitude: expect.closeTo(170),
    });
  });

  test('route length includes the loop return leg', () => {
    const points = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.01 },
    ];
    const once = routeLengthMeters(points);
    expect(once).toBeCloseTo(1112, -1);
    expect(routeLengthMeters(points, true)).toBeCloseTo(once * 2);
  });
});
