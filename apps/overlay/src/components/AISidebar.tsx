import { useState } from 'react';
import { ChevronRight, Send, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

interface AISidebarProps {
  summary: string;
  isProcessing: boolean;
  onQueryAI: (query: string) => Promise<{ success: boolean; answer?: string; snippets?: string; error?: string }>;
  isVisible: boolean;
  onToggle: () => void;
}

export function AISidebar({
  summary,
  isProcessing,
  onQueryAI,
  isVisible,
  onToggle,
}: AISidebarProps) {
  const [query, setQuery] = useState('');
  const [qaResult, setQaResult] = useState<{ answer?: string; snippets?: string[]; error?: string } | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  const handleAsk = async () => {
    if (!query.trim() || isQuerying) return;

    setIsQuerying(true);
    setQaResult(null);

    const result = await onQueryAI(query.trim());

    if (result.success) {
      setQaResult({
        answer: result.answer,
        snippets: result.snippets ? result.snippets.split('\n').filter(Boolean) : [],
      });
    } else {
      setQaResult({ error: result.error });
    }

    setIsQuerying(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  if (!isVisible) {
    return (
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-1/2 right-0 -translate-y-1/2 size-6 rounded-l-md rounded-r-none
                 bg-white/10 hover:bg-white/20 border border-r-0 border-white/20"
        onClick={onToggle}
      >
        <ChevronRight className="size-4" />
      </Button>
    );
  }

  return (
    <div className="flex flex-col h-full glass-panel animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-white/90">AI Analysis</span>
          {isProcessing && (
            <Loader2 className="size-3 text-amber-400 animate-spin" />
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="size-5"
          onClick={onToggle}
        >
          <ChevronRight className="size-3 rotate-180" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Summary Section */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-white/80 uppercase tracking-wide">
              Summary
            </h4>
            <div className="text-[10px] leading-relaxed text-white/85 bg-black/20 p-2 rounded border-l-2 border-blue-500/50">
              {summary || (
                <span className="italic text-white/50">Waiting for conversation...</span>
              )}
            </div>
          </div>

          {/* Q&A Section */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-white/80 uppercase tracking-wide">
              Ask a Question
            </h4>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Ask about what was just said..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-[11px] h-8 bg-black/25 border-white/20 text-white placeholder:text-white/50"
                disabled={isQuerying}
              />
              <Button
                size="icon"
                className="size-8 shrink-0"
                onClick={handleAsk}
                disabled={!query.trim() || isQuerying}
              >
                {isQuerying ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Send className="size-3" />
                )}
              </Button>
            </div>

            {/* Results */}
            {qaResult && (
              <div className="mt-3 space-y-2">
                {qaResult.error && (
                  <div className="text-[10px] text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                    {qaResult.error}
                  </div>
                )}

                {qaResult.answer && (
                  <div className="text-[10px] leading-relaxed text-white/85 bg-black/20 p-2 rounded">
                    {qaResult.answer}
                  </div>
                )}

                {qaResult.snippets && qaResult.snippets.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[9px] text-white/60">Relevant segments:</p>
                    <ul className="space-y-1">
                      {qaResult.snippets.map((snippet, i) => (
                        <li
                          key={i}
                          className="text-[9px] text-white/70 bg-black/20 p-1.5 rounded cursor-pointer hover:bg-black/30"
                        >
                          {snippet}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
