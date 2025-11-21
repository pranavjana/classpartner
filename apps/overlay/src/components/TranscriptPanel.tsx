import { useEffect, useRef } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import type { TranscriptSegment } from '../hooks/useTranscription';

interface TranscriptPanelProps {
  interimText: string;
  finalSegments: TranscriptSegment[];
  isRecording: boolean;
}

export function TranscriptPanel({
  interimText,
  finalSegments,
  isRecording,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [finalSegments, interimText]);

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 0.8) return 'text-white/95';
    if (confidence >= 0.6) return 'text-white/80';
    return 'text-white/60 italic';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border-b border-red-500/30 animate-fade-in">
          <div className="size-1.5 rounded-full bg-red-500 animate-pulse-dot" />
          <span className="text-[10px] text-red-400 font-medium">Recording...</span>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div
          ref={scrollRef}
          className="p-4 space-y-1 text-[12px] leading-relaxed select-text"
        >
          {finalSegments.length === 0 && !interimText && (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
              <p className="text-white/50 italic text-[11px]">
                Ready for transcription...
              </p>
              <p className="text-white/30 text-[10px] mt-2">
                Press the record button to start
              </p>
            </div>
          )}

          {/* Final segments */}
          {finalSegments.map((segment, index) => (
            <span
              key={segment.id}
              className={cn(
                "inline",
                getConfidenceClass(segment.confidence),
                index === finalSegments.length - 1 && "bg-emerald-500/10 px-0.5 rounded"
              )}
            >
              {segment.text}{' '}
            </span>
          ))}

          {/* Interim text */}
          {interimText && (
            <span className="inline text-white/60 italic">
              {interimText}
            </span>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
