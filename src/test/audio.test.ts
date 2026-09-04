import { describe, expect, it } from 'vitest';
import { spinAudioConfig } from '../utils/audio';

describe('spin audio config', () => {
  it('uses an event-length rhythmic spin window', () => {
    expect(spinAudioConfig.durationSec).toBe(5);
    expect(spinAudioConfig.bpm).toBeGreaterThanOrEqual(132);
    expect(spinAudioConfig.bpm).toBeLessThanOrEqual(145);
  });

  it('keeps tunable rhythm levels bounded', () => {
    expect(spinAudioConfig.masterVolume).toBeGreaterThan(0);
    expect(spinAudioConfig.masterVolume).toBeLessThanOrEqual(0.25);
    expect(spinAudioConfig.kickVolume).toBeGreaterThan(spinAudioConfig.hatVolume);
    expect(spinAudioConfig.synthVolume).toBeLessThan(spinAudioConfig.kickVolume);
  });
});
