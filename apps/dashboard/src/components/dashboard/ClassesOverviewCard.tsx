"use client";

import { useClasses } from "@/lib/classes/provider";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

export default function ClassesOverviewCard({ className = "" }: { className?: string }) {
  const { ready, classes } = useClasses();

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
            <div key={c.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted cursor-pointer">
              <span className="h-3 w-3 rounded-full bg-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{c.code} — {c.name}</p>
              </div>
              <Badge variant="secondary" className="text-xs font-normal">
                {(c.transcriptions ?? 0)} Transcriptions
              </Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
