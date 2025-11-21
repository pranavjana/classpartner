import { useState, useCallback, useRef, useEffect } from 'react';

// Browser AudioService implementation (from original renderer.js)
class AudioService {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isRecording = false;

  async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      return false;
    }
  }

  async startRecording(micGain: number = 1.0): Promise<boolean> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Use ScriptProcessor for audio processing
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = micGain;
      this.processor = this.audioContext.createScriptProcessor(1024, 1, 1);

      this.processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        // Convert to PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = sample < 0 ? (sample * 32768) | 0 : (sample * 32767) | 0;
        }

        // Send to Deepgram via Electron
        if (window.electronAPI) {
          window.electronAPI.sendAudioData(Array.from(new Uint8Array(pcmData.buffer)));
        }
      };

      this.source.connect(this.gainNode);
      this.gainNode.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isRecording = true;
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }

  stopRecording() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.isRecording = false;
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  updateGain(gain: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = gain;
    }
  }
}

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [micGain, setMicGain] = useState(1.0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const audioServiceRef = useRef<AudioService>(new AudioService());

  const startRecording = useCallback(async () => {
    if (!window.transcription || !window.electronAPI) {
      console.error('Electron APIs not available');
      return false;
    }

    try {
      // Check microphone permission
      const hasPermission = await audioServiceRef.current.requestMicrophonePermission();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }

      // Start Deepgram transcription
      const result = await window.transcription.start();
      if (!result.success) {
        throw new Error(result.error || 'Failed to start transcription');
      }

      setCurrentSessionId(result.sessionId || null);

      // Start audio recording
      const audioStarted = await audioServiceRef.current.startRecording(micGain);
      if (!audioStarted) {
        await window.electronAPI.stopTranscription();
        throw new Error('Failed to start audio recording');
      }

      setIsRecording(true);
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      return false;
    }
  }, [micGain]);

  const stopRecording = useCallback(async () => {
    try {
      setIsRecording(false);

      // Stop audio recording
      audioServiceRef.current.stopRecording();

      // Stop Deepgram transcription
      if (window.electronAPI) {
        const result = await window.electronAPI.stopTranscription();
        console.log('Session ended:', result);
      }

      setCurrentSessionId(null);
      return true;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return false;
    }
  }, []);

  const updateMicGain = useCallback((gain: number) => {
    setMicGain(gain);
    audioServiceRef.current.updateGain(gain);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioServiceRef.current.isCurrentlyRecording()) {
        audioServiceRef.current.stopRecording();
      }
    };
  }, []);

  return {
    isRecording,
    micGain,
    currentSessionId,
    startRecording,
    stopRecording,
    updateMicGain,
  };
}
