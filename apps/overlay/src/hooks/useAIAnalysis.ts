import { useState, useEffect, useCallback } from 'react';
import type { AIUpdate } from '../types/electron';

export function useAIAnalysis() {
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.ai) return;

    // Listen for AI updates
    window.ai.onUpdate((payload: AIUpdate) => {
      if (payload.summary) {
        setSummary(payload.summary);
      }
      setIsProcessing(false);
    });

    // Listen for AI errors
    window.ai.onError((errorData: any) => {
      const errorMsg = errorData.message || JSON.stringify(errorData);
      setError(errorMsg);
      setIsProcessing(false);
    });

    // Listen for AI log events (for processing status)
    window.ai.onLog((logData: any) => {
      // Optional: track processing state
      if (logData.message?.includes('Processing')) {
        setIsProcessing(true);
      }
    });
  }, []);

  const queryAI = useCallback(async (query: string): Promise<{ success: boolean; answer?: string; snippets?: string; error?: string }> => {
    if (!window.api) {
      return { success: false, error: 'AI API not available' };
    }

    try {
      setIsProcessing(true);
      const result = await window.api.invoke('ai:query', { query, opts: { k: 6 } });
      setIsProcessing(false);
      return result;
    } catch (error: any) {
      setIsProcessing(false);
      const errorMsg = error?.message || String(error);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  return {
    summary,
    isProcessing,
    error,
    queryAI,
  };
}
