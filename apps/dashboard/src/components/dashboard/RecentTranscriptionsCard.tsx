"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/lib/dashboard/provider";
import { useClasses } from "@/lib/classes/provider";

export default function RecentTranscriptionsCard({ className = "" }: { className?: string }) {
  const { recentTranscriptions, ready } = useDashboardData();
  const { classes } = useClasses();
  const items = recentTranscriptions(4);

  if (!ready) {
    return (
      <div className={`bg-card border border-border rounded-2xl p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Transcriptions</h2>
          <span className="text-xs text-muted-foreground">Loading…</span>
        </div>
        <div className="space-y-3 text-xs text-muted-foreground">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-2xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Transcriptions</h2>
        <Button variant="ghost" size="sm" className="text-xs" asChild>
          <Link href="/transcriptions">Browse all</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No transcripts yet. Start a new session or add a manual note to see them here.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((tx) => {
            const classInfo = tx.classId ? classes.find((cls) => cls.id === tx.classId) : undefined;
            return (
              <div key={tx.id} className="flex gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{tx.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(tx.createdAt), "MMM d, yyyy")}
                        {classInfo ? ` • ${classInfo.code}` : ""}
                      </p>
                    </div>
                    <Button size="sm" asChild variant="outline">
                      <Link href={`/transcriptions/view?id=${tx.id}`}>Open</Link>
                    </Button>
                  </div>

                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {tx.summary ? tx.summary : "No summary yet."}
                  </p>

                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {tx.keyPoints?.slice(0, 2).map((point, index) => (
                      <span
                        key={`${tx.id}-kp-${index}`}
                        className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5"
                      >
                        {point}
                      </span>
                    ))}
                    {tx.actionItems?.length ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary">
                        {tx.actionItems.length} action{tx.actionItems.length === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
