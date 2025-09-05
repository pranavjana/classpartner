const EventEmitter = require('events');

class AudioService extends EventEmitter {
  constructor() {
    super();
    this.mediaStream = null;
    this.audioContext = null;
    this.workletNode = null;
    this.analyser = null;
    this.isRecording = false;
    this.audioLevel = 0;
    this.animationId = null;
    this.selectedDeviceId = null; // optional: set via setter below
  }

  async requestMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      this.emit('permission-denied', error);
      return false;
    }
  }

  async startRecording() {
    try {
      if (this.isRecording) return false;

      // 1) Acquire mic at native rate (downsample in worklet for best quality)
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // 2) AudioContext (worklet will resample to 16 kHz)
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // 3) Load processor and create node
      await this.audioContext.audioWorklet.addModule('audio-processor.js');
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm16-worklet', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        processorOptions: {
          targetSampleRate: 16000,
          chunkSize: 1600, // 100ms @ 16kHz
        }
      });

      // 4) Level meter analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect graph
      source.connect(this.workletNode);
      source.connect(this.analyser);
      // Worklet output is not routed to speakers; no need to connect to destination

      // 5) Stream PCM Int16 buffers to main
      this.workletNode.port.onmessage = (e) => {
        const { type, payload } = e.data || {};
        if (type === 'pcm16') {
          window.transcription.sendAudio(payload); // payload is a Uint8Array (transferable-friendly)
        } else if (type === 'audioLevel') {
          this.emit('audio-level', e.data.level);
        }
      };

      this.isRecording = true;
      this.monitorAudioLevel();
      this.emit('recording-started');
      console.log('Audio recording (PCM16) started');
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.emit('error', error);
      return false;
    }
  }

  monitorAudioLevel() {
    if (!this.analyser || !this.isRecording) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const tick = () => {
      if (!this.isRecording) return;
      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      this.audioLevel = Math.round((avg / 255) * 100);
      this.emit('audio-level', this.audioLevel);
      this.animationId = requestAnimationFrame(tick);
    };

    tick();
  }

  async stopRecording() {
    if (!this.isRecording) return false;
    try {
      this.isRecording = false;

      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      if (this.workletNode) {
        try { this.workletNode.port.postMessage({ type: 'stop' }); } catch {}
        this.workletNode.disconnect();
        this.workletNode = null;
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(t => t.stop());
        this.mediaStream = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
      }
      this.audioContext = null;
      this.analyser = null;
      this.audioLevel = 0;

      this.emit('recording-stopped');
      console.log('Audio recording stopped');
      return true;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.emit('error', error);
      return false;
    }
  }

  isCurrentlyRecording() { return this.isRecording; }
  getCurrentAudioLevel() { return this.audioLevel; }

  async checkMicrophoneAvailability() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(d => d.kind === 'audioinput');
    } catch (e) {
      console.error('Failed to check microphone availability:', e);
      return false;
    }
  }

  async getAudioInputDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0,8)}...` }));
    } catch (e) {
      console.error('Failed to get audio input devices:', e);
      return [];
    }
  }

  setInputDevice(deviceId) {
    this.selectedDeviceId = deviceId || null;
  }

  destroy() {
    this.stopRecording();
    this.removeAllListeners();
  }
}

module.exports = AudioService;
