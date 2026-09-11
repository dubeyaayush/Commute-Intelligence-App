import { findGaps, scoreArrival } from './arrival';
import { METRO_CONFIG } from './metro.config';

const GAP_MIN_MS = METRO_CONFIG.gapMinSec * 1000;

describe('metro arrival — gap finding (step 1)', () => {
  it('finds no gaps in a continuous 1 Hz GPS stream', () => {
    const cont = Array.from({ length: 60 }, (_, k) => ({ t: k * 1000, lat: 28.6, lng: 77.2 }));
    expect(findGaps(cont, GAP_MIN_MS)).toHaveLength(0);
  });

  it('finds a single underground-length gap and its reappearance point', () => {
    const samples = [
      { t: 0, lat: 28.6, lng: 77.2 },
      { t: 1000, lat: 28.6, lng: 77.2 },
      { t: 300_000, lat: 28.64, lng: 77.23 }, // 299 s gap
    ];
    const gaps = findGaps(samples, GAP_MIN_MS);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].durationSec).toBe(299);
    expect(gaps[0].reappearLat).toBeCloseTo(28.64);
    expect(gaps[0].reappearLng).toBeCloseTo(77.23);
  });

  it('ignores a gap shorter than the minimum (a brief signal drop is not a metro ride)', () => {
    const samples = [
      { t: 0, lat: 28.6, lng: 77.2 },
      { t: 60_000, lat: 28.6, lng: 77.2 }, // 60 s < 90 s
    ];
    expect(findGaps(samples, GAP_MIN_MS)).toHaveLength(0);
  });
});

describe('metro arrival — confidence scoring (step 1)', () => {
  it('scores a long gap resurfacing near a station high enough to fire', () => {
    const v = scoreArrival(300, 20, 200, true);
    expect(v.confidence).toBeGreaterThanOrEqual(METRO_CONFIG.threshold);
  });

  it('scores a short gap far from the station below threshold (no false arrival)', () => {
    const v = scoreArrival(100, 190, 200, false);
    expect(v.confidence).toBeLessThan(METRO_CONFIG.threshold);
  });

  it('gives higher confidence when the ride also began near a station', () => {
    const withEntry = scoreArrival(200, 50, 200, true);
    const withoutEntry = scoreArrival(200, 50, 200, false);
    expect(withEntry.confidence).toBeGreaterThan(withoutEntry.confidence);
  });
});