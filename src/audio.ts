// Soft synthesized UI sounds (no audio files). Off switch in Settings.

type Cue = 'click' | 'reveal' | 'success' | 'warn' | 'snap' | 'lock';

const CUES: Record<Cue, { f: number; f2?: number; d: number; type: OscillatorType }> = {
  click: { f: 660, d: 0.05, type: 'sine' },
  reveal: { f: 520, f2: 780, d: 0.16, type: 'sine' },
  success: { f: 523, f2: 1046, d: 0.28, type: 'triangle' },
  warn: { f: 330, f2: 260, d: 0.2, type: 'sine' },
  snap: { f: 1200, d: 0.04, type: 'square' },
  lock: { f: 880, f2: 990, d: 0.09, type: 'triangle' },
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.25;

  configure(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = volume;
  }

  play(cue: Cue) {
    if (!this.enabled || this.volume <= 0) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx ??= new AC();
      const ctx = this.ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const c = CUES[cue];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = c.type;
      osc.frequency.setValueAtTime(c.f, ctx.currentTime);
      if (c.f2) osc.frequency.linearRampToValueAtTime(c.f2, ctx.currentTime + c.d);
      const peak = 0.12 * this.volume * (c.type === 'square' ? 0.4 : 1);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + c.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + c.d + 0.02);
    } catch {
      /* audio is optional */
    }
  }
}

export const sound = new SoundEngine();
