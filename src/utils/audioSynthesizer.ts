/**
 * Built-in Web Audio API Music Synthesizer for Demo Tracks.
 * Allows the Listening Party app to play real synthesized audio out-of-the-box
 * before the host loads their own MP3/WAV audio files!
 */

class DemoSynthesizer {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private currentTrackIndex = 0;
  private timer: number | null = null;
  private tempo = 120; // BPM
  private currentBeat = 0;
  private masterGain: GainNode | null = null;
  private startTime = 0;
  private pauseOffset = 0;
  private onTimeUpdateCallback: ((seconds: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;

  public init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.65;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(val: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime);
    }
  }

  public play(trackIndex: number, startFromSeconds = 0, onUpdate?: (sec: number) => void, onEnded?: () => void) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    this.currentTrackIndex = trackIndex;
    this.onTimeUpdateCallback = onUpdate || null;
    this.onEndedCallback = onEnded || null;
    this.pauseOffset = startFromSeconds;
    this.startTime = this.ctx.currentTime - startFromSeconds;
    this.isPlaying = true;

    // Set BPM based on track
    if (trackIndex === 0) this.tempo = 124; // Midnight Neon (Synthwave / Dance)
    else if (trackIndex === 1) this.tempo = 138; // Bassline Symphony (Trap / Electronic)
    else this.tempo = 100; // Golden Hour Vibe (Chill R&B / Lo-fi)

    this.scheduleNotes();
  }

  public seek(seconds: number) {
    if (!this.ctx) return;
    this.pauseOffset = seconds;
    this.startTime = this.ctx.currentTime - seconds;
  }

  public pause() {
    this.isPlaying = false;
    if (this.timer) {
      window.cancelAnimationFrame(this.timer);
      this.timer = null;
    }
  }

  public stop() {
    this.pause();
    this.pauseOffset = 0;
  }

  private scheduleNotes() {
    if (!this.isPlaying || !this.ctx || !this.masterGain) return;

    const currentSeconds = Math.max(0, this.ctx.currentTime - this.startTime);
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(currentSeconds);
    }

    // Check track length limit (approx 3 min)
    const trackDurations = [184, 215, 198];
    const duration = trackDurations[this.currentTrackIndex] || 180;
    if (currentSeconds >= duration) {
      this.isPlaying = false;
      if (this.onEndedCallback) this.onEndedCallback();
      return;
    }

    // Calculate beat from current seconds
    const secondsPerBeat = 60 / this.tempo;
    const beatIndex = Math.floor(currentSeconds / (secondsPerBeat / 4)); // 16th notes

    if (beatIndex !== this.currentBeat) {
      this.currentBeat = beatIndex;
      this.triggerStep(beatIndex % 32, this.currentBeat);
    }

    this.timer = window.requestAnimationFrame(() => this.scheduleNotes());
  }

  private triggerStep(step16: number, absoluteStep: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Kick on quarter notes (steps 0, 4, 8, 12, 16, 20, 24, 28)
    if (step16 % 4 === 0) {
      this.playKick(now);
    }

    // Snare / Clap on beats 2 and 4 (steps 8 and 24)
    if (step16 === 8 || step16 === 24) {
      this.playSnare(now);
    }

    // Hi-hat on 8th notes or 16th notes
    if (step16 % 2 === 0) {
      this.playHiHat(now, step16 % 4 === 0 ? 0.3 : 0.15);
    }

    // Bassline note
    if (step16 % 4 === 0 || (this.currentTrackIndex === 1 && step16 % 4 === 2)) {
      const bassNotes = [55, 55, 65.41, 49, 55, 58.27, 49, 43.65];
      const noteIdx = Math.floor(absoluteStep / 8) % bassNotes.length;
      this.playBass(now, bassNotes[noteIdx]);
    }

    // Synth chord / lead
    if (step16 === 0 || step16 === 6 || step16 === 12 || step16 === 18) {
      const chords = [
        [220, 261.63, 329.63], // Am
        [174.61, 220, 261.63], // F
        [261.63, 329.63, 392],  // C
        [196, 246.94, 293.66], // G
      ];
      const chordIdx = Math.floor(absoluteStep / 32) % chords.length;
      this.playChord(now, chords[chordIdx]);
    }
  }

  private playKick(time: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.15);

    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.32);
  }

  private playSnare(time: number) {
    if (!this.ctx || !this.masterGain) return;
    // Tone component
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
    oscGain.gain.setValueAtTime(0.5, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.13);

    // Noise component
    const bufferSize = this.ctx.sampleRate * 0.18;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.2);
  }

  private playHiHat(time: number, volume: number) {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.05);
  }

  private playBass(time: number, freq: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, time);
    filter.Q.setValueAtTime(3, time);

    gain.gain.setValueAtTime(0.45, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  private playChord(time: number, freqs: number[]) {
    if (!this.ctx || !this.masterGain) return;
    freqs.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, time);

      gain.gain.setValueAtTime(0.12, time);
      gain.gain.linearRampToValueAtTime(0.09, time + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.55);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(time);
      osc.stop(time + 0.58);
    });
  }
}

export const demoSynth = new DemoSynthesizer();
