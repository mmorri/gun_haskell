// Tiny procedural sound engine - no audio files, no loading, no excuses.

export type SfxName =
  | "pew"
  | "brrrt"
  | "boom"
  | "hit"
  | "coin"
  | "upgrade"
  | "wave"
  | "leak"
  | "over"
  | "click"
  | "place"
  | "select";

const BASS = [55, 55, 43.65, 43.65, 65.41, 65.41, 49, 49];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private nextNote = 0;
  private step = 0;
  muted = false;
  musicOn = true;

  constructor(muted: boolean, music: boolean) {
    this.muted = muted;
    this.musicOn = music;
  }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.noiseBuffer = this.makeNoise();
      if (this.musicOn) this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private makeNoise(): AudioBuffer | null {
    if (!this.ctx) return null;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
    when?: number,
    dest?: AudioNode,
  ): void {
    if (!this.ctx || !this.master) return;
    const t = when ?? this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    env.connect(dest ?? this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, cutoff: number, when?: number): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const t = when ?? this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.25), t + dur);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  sfx(name: SfxName, pan = 0): void {
    if (!this.ctx || this.muted) return;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(this.master!);
    switch (name) {
      case "pew":
        this.tone(760, 0.07, "square", 0.05, 320, undefined, panner);
        break;
      case "brrrt":
        this.tone(330, 0.035, "square", 0.035, 220, undefined, panner);
        break;
      case "boom":
        this.noise(0.28, 0.14, 900);
        this.tone(120, 0.22, "sine", 0.1, 45);
        break;
      case "hit":
        this.tone(190, 0.035, "triangle", 0.025, 120, undefined, panner);
        break;
      case "coin":
        this.tone(880, 0.05, "sine", 0.035);
        this.tone(1320, 0.07, "sine", 0.03, undefined, this.ctx.currentTime + 0.05);
        break;
      case "upgrade":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, "triangle", 0.04, undefined, this.ctx!.currentTime + i * 0.06));
        break;
      case "wave":
        this.tone(180, 0.35, "sawtooth", 0.055, 300);
        this.tone(90, 0.4, "sine", 0.06, 140);
        break;
      case "leak":
        this.tone(300, 0.32, "sawtooth", 0.08, 70);
        this.noise(0.2, 0.08, 600);
        break;
      case "over":
        [392, 311, 233, 155].forEach((f, i) => this.tone(f, 0.38, "triangle", 0.06, undefined, this.ctx!.currentTime + i * 0.16));
        break;
      case "click":
        this.tone(600, 0.03, "square", 0.025);
        break;
      case "place":
        this.tone(300, 0.1, "triangle", 0.05, 520);
        this.noise(0.08, 0.03, 1400);
        break;
      case "select":
        this.tone(520, 0.04, "square", 0.02, 660);
        break;
    }
  }

  startMusic(): void {
    if (!this.ctx || !this.musicOn || this.musicTimer !== null) return;
    this.nextNote = this.ctx.currentTime + 0.08;
    this.step = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 30);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusic(): void {
    if (!this.ctx || !this.musicGain) return;
    const stepDur = 0.21;
    while (this.nextNote < this.ctx.currentTime + 0.12) {
      const s = this.step % 16;
      if (s % 4 === 0) this.tone(BASS[(this.step >> 2) % BASS.length], 0.36, "triangle", 0.09, undefined, this.nextNote, this.musicGain);
      if (s % 2 === 0) {
        const scale = [220, 261.63, 329.63, 392, 440, 523.25];
        const note = scale[(s * 3 + (this.step >> 4)) % scale.length];
        this.tone(note, 0.14, "sine", 0.025, undefined, this.nextNote, this.musicGain);
      }
      if (s === 8) this.noise(0.06, 0.018, 3000, this.nextNote);
      this.nextNote += stepDur;
      this.step++;
    }
  }
}
