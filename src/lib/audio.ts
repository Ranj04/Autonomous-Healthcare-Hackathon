// PCM16 <-> base64 helpers and a gapless player for 24kHz realtime audio.

export const SAMPLE_RATE = 24000;

// Float32 mic samples [-1,1] -> base64-encoded little-endian PCM16.
export function floatToPcm16Base64(input: Float32Array): string {
  const pcm = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Linear-resample a mono Float32 frame to 24kHz. iOS/Safari frequently ignore
// the requested AudioContext sampleRate and run the mic at 48kHz; without this
// the agent receives the wrong pitch/speed and voice barely works in the iOS
// WebView. No-op when already at 24kHz (e.g. Chrome honors the request).
export function resampleTo24k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === SAMPLE_RATE || input.length === 0) return input;
  const ratio = inputRate / SAMPLE_RATE;
  const outLen = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    out[i] = input[i0] + (input[i1] - input[i0]) * (pos - i0);
  }
  return out;
}

// base64 PCM16 -> Float32 samples.
function pcm16Base64ToFloat(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer);
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 0x8000;
  return out;
}

// Schedules incoming audio chunks back-to-back so playback is gapless.
export class PcmPlayer {
  private ctx: AudioContext;
  private playhead = 0;
  private analyser: AnalyserNode;
  private bins: Uint8Array<ArrayBuffer>;

  constructor() {
    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    // Tap an analyser between the sources and the speakers so callers can read
    // the agent's live amplitude (for the talking orb).
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.connect(this.ctx.destination);
    this.bins = new Uint8Array(this.analyser.fftSize);
  }

  resume() {
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  enqueue(b64: string) {
    const samples = pcm16Base64ToFloat(b64);
    if (samples.length === 0) return;
    const buffer = this.ctx.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.analyser);
    const now = this.ctx.currentTime;
    const startAt = Math.max(now, this.playhead);
    src.start(startAt);
    this.playhead = startAt + buffer.duration;
  }

  // Current output loudness as 0..1 (RMS of the time-domain signal). 0 when
  // nothing is scheduled to play.
  level(): number {
    if (this.ctx.currentTime >= this.playhead) return 0;
    this.analyser.getByteTimeDomainData(this.bins);
    let sum = 0;
    for (let i = 0; i < this.bins.length; i++) {
      const v = (this.bins[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.bins.length) * 3);
  }

  // Drop anything still scheduled (e.g. user interrupts).
  clear() {
    this.playhead = this.ctx.currentTime;
  }

  close() {
    this.ctx.close();
  }
}
