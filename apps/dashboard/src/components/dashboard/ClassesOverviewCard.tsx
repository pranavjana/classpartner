"use client";

import * as React from "react";
import Link from "next/link";
import { useClasses } from "@/lib/classes/provider";
import { useDashboardData } from "@/lib/dashboard/provider";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

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

  return (
    <div className={`bg-card border border-border rounded-2xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Classes Overview</h2>
        <span className="text-xs text-muted-foreground">Manage Classes</span>
      </div>

      {!ready ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : classes.length === 0 ? (
        <div className="text-sm text-muted-foreground">No classes yet — add one from the sidebar.</div>
      ) : (
        <div className="space-y-3">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={`/classes/${c.slug}`}
              className="flex items-center gap-4 rounded-lg p-2 transition hover:bg-muted"
            >
              <span className="h-3 w-3 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {c.code} — {c.name}
                </p>
              </div>
              <Badge variant="secondary" className="text-xs font-normal">
                {(counts[c.id] ?? c.transcriptions ?? 0)} transcriptions
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
