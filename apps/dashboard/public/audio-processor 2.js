// audio-processor.js
// AudioWorklet processor: downmix -> resample (to 16k) -> Int16 PCM -> postMessage
class PCM16Worklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { targetSampleRate = 16000, chunkSize = 1600 } = (options.processorOptions || {});
    this.targetRate = targetSampleRate;    // 16k Hz
    this.chunkSize  = chunkSize;           // samples per chunk @ targetRate (~100ms)

    this.inRate = sampleRate;              // context rate (e.g., 44.1k/48k)
    this.buf = [];                         // queue of Float32 subarrays (targetRate)

    // Audio level meter (UI feedback @ ~60 fps)
    this.levelN = 128;
    this.levelBuf = new Float32Array(this.levelN);
    this.levelIdx = 0;
    this.lastLevelFrame = 0;
    this.levelIntervalFrames = Math.round(this.inRate / 60); // ~60 fps

    this.stopped = false;

    this.port.onmessage = (e) => {
      if (e.data?.type === 'stop') this.stopped = true;
    };
  }

  // Downmix any #channels to mono
  downmixToMono(input) {
    if (!input || input.length === 0) return new Float32Array(0);
    if (input.length === 1) return input[0];
    const frames = input[0].length;
    const mono = new Float32Array(frames);
    for (let c = 0; c < input.length; c++) {
      const ch = input[c];
      for (let i = 0; i < frames; i++) mono[i] += ch[i];
    }
    for (let i = 0; i < frames; i++) mono[i] /= input.length;
    return mono;
  }

  // Simple linear resampler (good enough for speech)
  resampleFloat32(monoIn, fromRate, toRate) {
    if (fromRate === toRate || monoIn.length === 0) return monoIn;
    const ratio = fromRate / toRate;
    const outLen = Math.floor(monoIn.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const idx = i * ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, monoIn.length - 1);
      const frac = idx - i0;
      out[i] = monoIn[i0] * (1 - frac) + monoIn[i1] * frac;
    }
    return out;
  }

  floatToPCM16(f32) {
    const i16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      let s = Math.max(-1, Math.min(1, f32[i]));
      i16[i] = (s < 0 ? s * 0x8000 : s * 0x7FFF) | 0;
    }
    return new Uint8Array(i16.buffer); // little-endian
  }

  // Concatenate queued Float32Arrays into exactly N samples
  takeChunkExact(n) {
    let need = n;
    const out = new Float32Array(n);
    let off = 0;
    while (need > 0 && this.buf.length) {
      const head = this.buf[0];
      if (head.length <= need) {
        out.set(head, off);
        off += head.length;
        need -= head.length;
        this.buf.shift();
      } else {
        out.set(head.subarray(0, need), off);
        this.buf[0] = head.subarray(need);
        off += need;
        need = 0;
      }
    }
    return (off === n) ? out : null;
  }

  postLevel(sample) {
    // simple RMS-ish tracker using abs, lightweight for UI
    this.levelBuf[this.levelIdx] = Math.abs(sample);
    this.levelIdx = (this.levelIdx + 1) % this.levelN;

    const frameNow = currentFrame;
    if (frameNow - this.lastLevelFrame >= this.levelIntervalFrames) {
      let sumSq = 0;
      for (let i = 0; i < this.levelN; i++) {
        const v = this.levelBuf[i];
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / this.levelN);
      const level = Math.min(100, Math.max(0, Math.floor(rms * 200)));
      this.port.postMessage({ type: 'audioLevel', level, frame: frameNow });
      this.lastLevelFrame = frameNow;
    }
  }

  process(inputs, _outputs, _parameters) {
    if (this.stopped) return false;

    const input = inputs[0];
    if (input && input.length > 0) {
      const mono = this.downmixToMono(input);
      // update level from current buffer (pick some samples)
      if (mono.length) this.postLevel(mono[0]);

      const resampled = this.resampleFloat32(mono, this.inRate, this.targetRate);
      if (resampled.length) this.buf.push(resampled);

      // emit fixed-size chunks at targetRate
      let ready = 0;
      for (let i = 0; i < this.buf.length; i++) ready += this.buf[i].length;
      while (ready >= this.chunkSize) {
        const chunk = this.takeChunkExact(this.chunkSize);
        if (!chunk) break;
        ready -= this.chunkSize;
        const bytes = this.floatToPCM16(chunk);
        // Transfer buffer ownership for zero-copy
        this.port.postMessage({ type: 'pcm16', payload: bytes }, [bytes.buffer]);
      }
    }

    return true;
  }
}

registerProcessor('pcm16-worklet', PCM16Worklet);
