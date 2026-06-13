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

  constructor() {
    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
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
    src.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    const startAt = Math.max(now, this.playhead);
    src.start(startAt);
    this.playhead = startAt + buffer.duration;
  }

  // Drop anything still scheduled (e.g. user interrupts).
  clear() {
    this.playhead = this.ctx.currentTime;
  }

  close() {
    this.ctx.close();
  }
}
