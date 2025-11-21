"use client";

import * as React from "react";
import Link from "next/link";
import { useClasses } from "@/lib/classes/provider";
import { useDashboardData } from "@/lib/dashboard/provider";
import { ArrowRight, BookOpen, Plus } from "lucide-react";

export default function ClassesOverviewCard({ className = "" }: { className?: string }) {
  const { ready, classes } = useClasses();
  const { transcriptions } = useDashboardData();

  const counts = React.useMemo(() => {
    return transcriptions.reduce<Record<string, number>>((acc, tx) => {
      if (!tx.classId) return acc;
      acc[tx.classId] = (acc[tx.classId] ?? 0) + 1;
      return acc;
    }, {});
  }, [transcriptions]);

  if (!ready) {
    return (
      <div className={`bg-card border border-border rounded-2xl p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Classes</h2>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border-2 border-border rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-normal underline decoration-primary decoration-2 underline-offset-4" style={{ fontFamily: 'Work Sans, sans-serif' }}>Classes</h2>
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group"
        >
          <Plus className="h-3 w-3" />
          Add class
        </button>
      </div>

      {/* Content */}
      {classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground max-w-[250px]">
            No classes yet. Add one from the sidebar to get started.
          </p>
        </div>
      ) : (
        <div className="-mx-6">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-2 text-xs font-medium text-muted-foreground border-b border-border/50">
            <div>Class</div>
            <div className="w-32">Code</div>
            <div className="text-right w-32">Transcripts</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border/50">
            {classes.map((c) => {
              const transcriptCount = counts[c.id] ?? c.transcriptions ?? 0;
              return (
                <Link
                  key={c.id}
                  href={`/classes/workspace?classId=${c.id}`}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 items-center py-3 px-6 hover:bg-muted/50 transition-colors group"
                >
                  {/* Class Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {c.name}
                    </span>
                  </div>

                  {/* Code */}
                  <div className="text-sm text-muted-foreground w-32 whitespace-nowrap">
                    {c.code}
                  </div>

                  {/* Transcript Count */}
                  <div className="text-sm text-muted-foreground text-right w-32">
                    {transcriptCount}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
