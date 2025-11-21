"use client";

import * as React from "react";
import { Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranscriptionLauncher, type LaunchOutcome } from "@/lib/transcription/use-launcher";
import { cn } from "@/lib/utils";

interface HeroCardProps {
  className?: string;
  onNewTranscription?: (context: LaunchOutcome) => void | Promise<void>;
}

export default function HeroCard({ className, onNewTranscription }: HeroCardProps) {
  const { launch, launching, dialog } = useTranscriptionLauncher({ onLaunch: onNewTranscription });

  return (
    <>
      {dialog}
      <Card className={cn("relative overflow-hidden border-2", className)}>
        {/* Bottom gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none bg-gradient-to-t from-[#1e82e0]/10 via-[#1c38ea]/5 to-transparent" />

        <CardContent className="p-8 md:p-12 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Left side - Text content */}
            <div className="flex-1 space-y-6">
              <div className="space-y-3">
                <h1 className="text-4xl md:text-5xl font-light tracking-tight leading-tight pr-1" style={{ fontFamily: 'Work Sans, sans-serif' }}>
                  Start{" "}
                  <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Transcribing
                  </span>
                </h1>

                <p className="text-lg text-muted-foreground max-w-xl">
                  Start a new session to get real-time transcription, smart summaries,
                  and actionable insights powered by Gemini.
                </p>
              </div>

              <button
                onClick={launch}
                disabled={launching}
                className="hero-gradient-button relative w-fit items-center gap-1.5 overflow-hidden px-5 py-2.5 font-medium tracking-[-0.13px] text-white flex rounded-full text-base transition-transform duration-[160ms] ease-out hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'radial-gradient(114.65% 114.65% at 9.73% 17.27%, #1e82e0 0, #1c38ea 100%)',
                  boxShadow: '0 10px 10px #0c39ed26, 0 2px 5px #0c39ed2b, inset -3px -3px 4px #bfe5fb66, inset 4px 4px 4px #131ae41a'
                }}
              >
                <span className="absolute top-0 left-0 z-20 h-full w-full blur-[1px] rounded-full overflow-hidden" aria-hidden="true">
                  <span className="blurred-border absolute -top-px -left-px z-20 h-[calc(100%+2px)] w-[calc(100%+2px)]"></span>
                </span>
                <Mic className="w-5 h-5 relative z-30" />
                <span className="relative z-30">{launching ? "Starting..." : "Start Transcription"}</span>
              </button>
            </div>

            {/* Right side - Transcription UI Preview */}
            <div className="relative w-full md:w-auto md:flex-shrink-0">
              <div className="relative w-full max-w-sm md:max-w-md lg:max-w-lg mx-auto">
                {/* Glass-like border container */}
                <div className="relative p-1 rounded-2xl bg-gradient-to-br from-white/20 via-white/10 to-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-sm">
                  {/* Inner shadow for depth */}
                  <div className="relative rounded-xl overflow-hidden shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_20px_40px_rgba(0,0,0,0.2),0_10px_20px_rgba(0,0,0,0.15)]">
                    <img
                      src="/hero.jpg"
                      alt="Live transcription interface"
                      className="w-full h-auto object-cover object-top rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
