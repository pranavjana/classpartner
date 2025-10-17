"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/lib/dashboard/provider";
import { useClasses } from "@/lib/classes/provider";

export default function RecentTranscriptionsCard({ className = "" }: { className?: string }) {
  const { recentTranscriptions } = useDashboardData();
  const { classes } = useClasses();
  const items = recentTranscriptions(4);

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
              <div key={tx.id} className="flex items-center gap-4">
                <div className="rounded-lg bg-muted p-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{tx.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(tx.createdAt), "MMM d, yyyy")}{" "}
                    {classInfo ? `• ${classInfo.code}` : ""}
                  </p>
                </div>
                <Button size="sm" asChild variant="outline">
                  <Link href={`/transcriptions/view?id=${tx.id}`}>Open</Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
