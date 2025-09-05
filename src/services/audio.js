const EventEmitter = require('events');

class AudioService extends EventEmitter {
  constructor() {
    super();
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.isRecording = false;
    this.audioLevel = 0;
    this.animationId = null;
  }

  async requestMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Test that we got permission and then stop the test stream
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      this.emit('permission-denied', error);
      return false;
    }
  }

  async startRecording() {
    try {
      if (this.isRecording) {
        console.log('Already recording');
        return false;
      }

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Set up audio analysis for level monitoring
      this.setupAudioAnalysis();

      // Set up MediaRecorder for Deepgram
      this.setupMediaRecorder();

      this.isRecording = true;
      this.emit('recording-started');
      console.log('Audio recording started');
      
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.emit('error', error);
      return false;
    }
  }

  setupAudioAnalysis() {
    if (!this.mediaStream) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      source.connect(this.analyser);
      
      // Start monitoring audio levels
      this.monitorAudioLevel();
    } catch (error) {
      console.error('Failed to setup audio analysis:', error);
    }
  }

  setupMediaRecorder() {
    if (!this.mediaStream) return;

    try {
      // Use appropriate MIME type for the browser
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/wav';
        }
      }

      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: mimeType,
        audioBitsPerSecond: 16000
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.emit('audio-data', event.data);
        }
      };

      this.mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        this.emit('error', error);
      };

      this.mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped');
        this.emit('recording-stopped');
      };

      // Start recording with small chunks for real-time streaming
      this.mediaRecorder.start(100); // 100ms chunks
    } catch (error) {
      console.error('Failed to setup MediaRecorder:', error);
      this.emit('error', error);
    }
  }

  monitorAudioLevel() {
    if (!this.analyser || !this.isRecording) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const updateLevel = () => {
      if (!this.isRecording) return;

      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate average level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      
      const average = sum / dataArray.length;
      this.audioLevel = Math.round((average / 255) * 100);
      
      this.emit('audio-level', this.audioLevel);
      
      this.animationId = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }

  stopRecording() {
    if (!this.isRecording) {
      console.log('Not currently recording');
      return false;
    }

    try {
      this.isRecording = false;

      // Stop animation frame
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }

      // Stop MediaRecorder
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }

      // Close audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }

      // Stop all media tracks
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => {
          track.stop();
        });
      }

      this.cleanup();
      this.emit('recording-stopped');
      console.log('Audio recording stopped');
      
      return true;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.emit('error', error);
      return false;
    }
  }

  cleanup() {
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.audioLevel = 0;
  }

  isCurrentlyRecording() {
    return this.isRecording;
  }

  getCurrentAudioLevel() {
    return this.audioLevel;
  }

  // Check if microphone is available
  async checkMicrophoneAvailability() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      return audioInputs.length > 0;
    } catch (error) {
      console.error('Failed to check microphone availability:', error);
      return false;
    }
  }

  // Get available audio input devices
  async getAudioInputDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.substr(0, 8)}...`
        }));
    } catch (error) {
      console.error('Failed to get audio input devices:', error);
      return [];
    }
  }

  // Destroy the service and clean up all resources
  destroy() {
    this.stopRecording();
    this.removeAllListeners();
  }
}

module.exports = AudioService;