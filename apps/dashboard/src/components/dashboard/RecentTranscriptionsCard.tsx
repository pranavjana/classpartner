"use client";

import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useDashboardData } from "@/lib/dashboard/provider";
import { useClasses } from "@/lib/classes/provider";

export default function RecentTranscriptionsCard({ className = "" }: { className?: string }) {
  const { recentTranscriptions, ready } = useDashboardData();
  const { classes } = useClasses();
  const items = recentTranscriptions(5);

  if (!ready) {
    return (
      <div className={`bg-card border border-border rounded-2xl p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Recent Transcriptions</h2>
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
        <h2 className="text-2xl font-normal underline decoration-primary decoration-2 underline-offset-4" style={{ fontFamily: 'Work Sans, sans-serif' }}>Recent Transcriptions</h2>
        <Link
          href="/transcriptions"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group"
        >
          View all
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground max-w-[250px]">
            No transcriptions yet. Start your first session to get started.
          </p>
        </div>
      ) : (
        <div className="-mx-6">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-2 text-xs font-medium text-muted-foreground border-b border-border/50">
            <div>Title</div>
            <div className="w-32">Date</div>
            <div className="text-right w-32">Class</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border/50">
            {items.map((tx) => {
              const classInfo = tx.classId ? classes.find((cls) => cls.id === tx.classId) : undefined;

              // Generate consistent random color based on tx.id
              const colors = [
                { bg: 'bg-blue-500/10', hover: 'group-hover:bg-blue-500/20', text: 'text-blue-500' },
                { bg: 'bg-green-500/10', hover: 'group-hover:bg-green-500/20', text: 'text-green-500' },
                { bg: 'bg-purple-500/10', hover: 'group-hover:bg-purple-500/20', text: 'text-purple-500' },
                { bg: 'bg-orange-500/10', hover: 'group-hover:bg-orange-500/20', text: 'text-orange-500' },
                { bg: 'bg-pink-500/10', hover: 'group-hover:bg-pink-500/20', text: 'text-pink-500' },
                { bg: 'bg-red-500/10', hover: 'group-hover:bg-red-500/20', text: 'text-red-500' },
                { bg: 'bg-teal-500/10', hover: 'group-hover:bg-teal-500/20', text: 'text-teal-500' },
                { bg: 'bg-indigo-500/10', hover: 'group-hover:bg-indigo-500/20', text: 'text-indigo-500' },
              ];
              const colorIndex = tx.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
              const color = colors[colorIndex];

              return (
                <Link
                  key={tx.id}
                  href={`/transcriptions/view?id=${tx.id}`}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 items-center py-3 px-6 hover:bg-muted/50 transition-colors group"
                >
                  {/* Title */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex-shrink-0 h-8 w-8 rounded-lg ${color.bg} flex items-center justify-center ${color.hover} transition-colors`}>
                      <FileText className={`h-4 w-4 ${color.text}`} />
                    </div>
                    <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {tx.title.replace(/\s*—\s*.*$/, '')}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="text-sm text-muted-foreground w-32 whitespace-nowrap">
                    {format(parseISO(tx.createdAt), "MMM d, h:mma")}
                  </div>

                  {/* Class */}
                  <div className="text-sm text-muted-foreground text-right w-32 truncate">
                    {classInfo ? classInfo.code : "—"}
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
