// AudioWorklet processor for low-latency audio capture
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 1024; // 64ms at 16kHz (reduced from 4096 for lower latency)
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.lastSendTime = 0;
    this.minSendInterval = 50; // Minimum 50ms between sends to avoid flooding
    
    // Audio level monitoring for immediate feedback
    this.audioLevelSamples = 128; // Smaller window for real-time level updates
    this.levelBuffer = new Float32Array(this.audioLevelSamples);
    this.levelIndex = 0;
    this.lastLevelUpdate = 0;
    this.levelUpdateInterval = 16; // ~60fps for smooth level updates
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const currentTime = currentFrame / sampleRate * 1000; // Current time in milliseconds
    
    if (input && input.length > 0) {
      const channelData = input[0]; // First channel
      
      for (let i = 0; i < channelData.length; i++) {
        const sample = channelData[i];
        this.buffer[this.bufferIndex] = sample;
        this.bufferIndex++;
        
        // Track audio levels for immediate visual feedback
        this.levelBuffer[this.levelIndex] = Math.abs(sample);
        this.levelIndex = (this.levelIndex + 1) % this.audioLevelSamples;
        
        // Send when buffer is full or enough time has passed
        if (this.bufferIndex >= this.bufferSize || 
            (this.bufferIndex > 0 && currentTime - this.lastSendTime >= this.minSendInterval)) {
          this.sendAudioData();
        }
      }
      
      // Send audio level updates for immediate visual feedback
      if (currentTime - this.lastLevelUpdate >= this.levelUpdateInterval) {
        this.sendAudioLevel();
        this.lastLevelUpdate = currentTime;
      }
    }
    
    return true; // Keep processor alive
  }
  
  sendAudioData() {
    if (this.bufferIndex === 0) return;
    
    // Create a copy of the current buffer data
    const audioData = new Float32Array(this.buffer.subarray(0, this.bufferIndex));
    
    // Convert Float32 to Int16 for Deepgram (optimized conversion)
    const pcmData = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    
    // Send to main thread
    this.port.postMessage({
      type: 'audio',
      data: pcmData.buffer,
      samples: audioData.length,
      timestamp: performance.now()
    });
    
    // Reset buffer
    this.bufferIndex = 0;
    this.lastSendTime = performance.now();
  }
  
  sendAudioLevel() {
    // Calculate RMS (Root Mean Square) audio level
    let sum = 0;
    for (let i = 0; i < this.audioLevelSamples; i++) {
      sum += this.levelBuffer[i] * this.levelBuffer[i];
    }
    const rms = Math.sqrt(sum / this.audioLevelSamples);
    
    // Convert to percentage (0-100) with logarithmic scaling for better visual
    const level = Math.min(100, Math.max(0, Math.floor(rms * 200)));
    
    // Send level update to main thread for immediate visual feedback
    this.port.postMessage({
      type: 'audioLevel',
      level: level,
      timestamp: performance.now()
    });
  }
}

registerProcessor('audio-processor', AudioProcessor);