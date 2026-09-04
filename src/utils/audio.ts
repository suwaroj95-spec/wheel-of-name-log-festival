export const spinAudioConfig = {
  bpm: 140,
  durationSec: 5,
  masterVolume: 0.16,
  kickVolume: 0.88,
  snareVolume: 0.42,
  hatVolume: 0.2,
  synthVolume: 0.18,
  finalHitVolume: 0.35,
} as const;

export class FestivalAudio {
  private context: AudioContext | null = null;
  private spinSources: AudioScheduledSourceNode[] = [];
  private spinMaster: GainNode | null = null;
  private spinCleanupTimers: number[] = [];

  async ensureContext(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  playTap(muted: boolean): void {
    if (muted || !this.context) return;
    this.tone(560, 0.06, 'square', 0.08);
    window.setTimeout(() => this.tone(840, 0.05, 'triangle', 0.06), 55);
  }

  startSpin(muted: boolean): void {
    if (muted || !this.context) {
      this.stopSpin();
      return;
    }
    if (this.spinMaster) this.stopSpin();

    const now = this.context.currentTime;
    const master = this.context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(spinAudioConfig.masterVolume, now + 0.08);
    master.gain.setValueAtTime(spinAudioConfig.masterVolume, now + spinAudioConfig.durationSec - 0.35);
    master.gain.exponentialRampToValueAtTime(0.0001, now + spinAudioConfig.durationSec - 0.04);
    master.connect(this.context.destination);
    this.spinMaster = master;

    const beat = 60 / spinAudioConfig.bpm;
    const step = beat / 2;
    const endAt = now + spinAudioConfig.durationSec - 0.18;
    let stepIndex = 0;

    for (let time = now; time < endAt; time += step) {
      const progress = Math.min((time - now) / spinAudioConfig.durationSec, 1);
      if (stepIndex % 2 === 0) this.scheduleKick(time, progress);
      this.scheduleHat(time, progress);
      if (stepIndex % 4 === 2) this.scheduleSnare(time, progress);
      if (stepIndex % 2 === 1 || progress > 0.68) this.scheduleSynthPulse(time, stepIndex, progress);
      stepIndex += 1;
    }

    this.scheduleFinalHit(now + spinAudioConfig.durationSec - 0.28);
    this.spinCleanupTimers.push(window.setTimeout(() => this.stopSpin(), spinAudioConfig.durationSec * 1000 + 80));
  }

  stopSpin(): void {
    this.spinCleanupTimers.forEach((timer) => window.clearTimeout(timer));
    this.spinCleanupTimers = [];
    if (!this.context || !this.spinMaster) return;
    const now = this.context.currentTime;
    const master = this.spinMaster;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    this.spinSources.forEach((source) => {
      try {
        source.stop(now + 0.14);
      } catch {
        // Already-ended scheduled nodes can be safely ignored during cleanup.
      }
    });
    this.spinCleanupTimers.push(window.setTimeout(() => master.disconnect(), 180));
    this.spinMaster = null;
    this.spinSources = [];
  }

  playWinner(muted: boolean): void {
    if (muted || !this.context) return;
    [523, 659, 784, 1046].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.16, 'triangle', 0.09), index * 90);
    });
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private scheduleKick(time: number, progress: number): void {
    if (!this.context || !this.spinMaster) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(142 + progress * 20, time);
    oscillator.frequency.exponentialRampToValueAtTime(46, time + 0.15);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(spinAudioConfig.kickVolume, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    oscillator.connect(gain);
    gain.connect(this.spinMaster);
    oscillator.start(time);
    oscillator.stop(time + 0.24);
    this.trackSpinSource(oscillator);
  }

  private scheduleSnare(time: number, progress: number): void {
    this.scheduleNoiseHit(time, 0.09, 1450 + progress * 700, spinAudioConfig.snareVolume, 'bandpass');
  }

  private scheduleHat(time: number, progress: number): void {
    const duration = progress > 0.7 ? 0.045 : 0.032;
    this.scheduleNoiseHit(time, duration, 6800 + progress * 2300, spinAudioConfig.hatVolume, 'highpass');
  }

  private scheduleSynthPulse(time: number, stepIndex: number, progress: number): void {
    if (!this.context || !this.spinMaster) return;
    const notes = [330, 392, 494, 587];
    const frequency = notes[stepIndex % notes.length] * (1 + progress * 0.45);
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900 + progress * 2600, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(spinAudioConfig.synthVolume * (0.7 + progress), time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.spinMaster);
    oscillator.start(time);
    oscillator.stop(time + 0.18);
    this.trackSpinSource(oscillator);
  }

  private scheduleFinalHit(time: number): void {
    this.scheduleNoiseHit(time, 0.12, 1100, spinAudioConfig.finalHitVolume, 'bandpass');
  }

  private scheduleNoiseHit(time: number, duration: number, frequency: number, volume: number, filterType: BiquadFilterType): void {
    if (!this.context || !this.spinMaster) return;
    const source = this.context.createBufferSource();
    const buffer = this.context.createBuffer(1, Math.max(1, Math.floor(this.context.sampleRate * duration)), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, time);
    filter.Q.setValueAtTime(filterType === 'bandpass' ? 1.8 : 0.7, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.spinMaster);
    source.start(time);
    source.stop(time + duration + 0.01);
    this.trackSpinSource(source);
  }

  private trackSpinSource(source: AudioScheduledSourceNode): void {
    this.spinSources.push(source);
    source.addEventListener('ended', () => {
      this.spinSources = this.spinSources.filter((item) => item !== source);
    }, { once: true });
  }
}
