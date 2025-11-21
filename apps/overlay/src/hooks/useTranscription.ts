import { useState, useEffect, useCallback } from 'react';
import type { TranscriptionData, ConnectionQuality } from '../types/electron';

export interface TranscriptSegment {
  id: string;
  text: string;
  confidence: number;
  timestamp: number;
  isFinal: boolean;
}

export function useTranscription() {
  const [interimText, setInterimText] = useState('');
  const [finalSegments, setFinalSegments] = useState<TranscriptSegment[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Listen for transcription data
    window.electronAPI.onTranscriptionData((data: TranscriptionData) => {
      if (data.is_final && data.text.trim()) {
        // Add to final segments
        const segment: TranscriptSegment = {
          id: data.id || `seg_${Date.now()}`,
          text: data.text.trim(),
          confidence: data.confidence || 0.9,
          timestamp: Date.now(),
          isFinal: true,
        };
        setFinalSegments(prev => [...prev, segment]);
        setInterimText(''); // Clear interim text
      } else if (!data.is_final) {
        // Update interim text
        setInterimText(data.text);
      }
    });

    // Listen for status changes
    window.electronAPI.onTranscriptionStatus((status: string) => {
      setConnectionStatus(status as any);
    });

    // Listen for errors
    window.electronAPI.onTranscriptionError((err) => {
      setError(err.message);
      setConnectionStatus('error');
    });

    // Listen for connection events
    window.electronAPI.onTranscriptionConnected(() => {
      setConnectionStatus('connected');
      setError(null);
    });

    window.electronAPI.onTranscriptionDisconnected(() => {
      setConnectionStatus('disconnected');
    });

    // Listen for connection quality
    window.electronAPI.onConnectionQualityChange((quality: ConnectionQuality) => {
      setConnectionQuality(quality);
    });

    return () => {
      window.electronAPI?.removeTranscriptionListeners();
    };
  }, []);

  const clearTranscript = useCallback(() => {
    setFinalSegments([]);
    setInterimText('');
  }, []);

  return {
    interimText,
    finalSegments,
    connectionStatus,
    connectionQuality,
    error,
    clearTranscript,
  };
}
