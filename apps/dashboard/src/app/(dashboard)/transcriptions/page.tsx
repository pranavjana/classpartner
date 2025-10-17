"use client";

import * as React from "react";
import Link from "next/link";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { Filter, FolderOpen, Search, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDashboardData, type TranscriptionRecordStatus } from "@/lib/dashboard/provider";
import { useClasses } from "@/lib/classes/provider";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: { value: "all" | TranscriptionRecordStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "in-progress", label: "In progress" },
  { value: "draft", label: "Drafts" },
];

const statusBadgeVariant: Record<TranscriptionRecordStatus, string> = {
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "in-progress": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  draft: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

function formatDuration(minutes: number) {
  if (!minutes) return "—";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  return `${hrs} hr ${mins} min`;
}

export default function TranscriptionsPage() {
  const { transcriptions } = useDashboardData();
  const { classes } = useClasses();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"all" | TranscriptionRecordStatus>("all");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return transcriptions
      .filter((tx) => {
        if (status !== "all" && tx.status !== status) return false;
        if (!q) return true;
        const classMatch = classes.find((cls) => cls.id === tx.classId);
        const haystack = [
          tx.title,
        tx.summary ?? "",
        classMatch?.code ?? "",
        classMatch?.name ?? "",
        tx.tags?.join(" ") ?? "",
      ]
        .join(" ")
        .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime());
  }, [transcriptions, status, query, classes]);

  const badgeFormatter = React.useMemo(
    () => new Intl.NumberFormat("en-US", { notation: "compact" }),
    []
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Transcriptions</h1>
        <p className="text-sm text-muted-foreground">
          Browse your captured sessions, drafts, and quick notes. Filter by status or class to jump back in.
        </p>
      </div>

      <Card className="border-border">
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by class, title, or keyword…"
                  className="pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((option) => (
                <Button
                  key={option.value}
                  variant={option.value === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatus(option.value)}
                  className="gap-1"
                >
                  <Filter className="h-4 w-4" />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">No transcripts match your filters.</p>
                <p className="text-xs text-muted-foreground">
                  Adjust the status filter or clear your search.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-3">
                {filtered.map((tx) => {
                  const txDate = parseISO(tx.createdAt);
                  const classInfo = classes.find((cls) => cls.id === tx.classId);
                  return (
                    <article
                      key={tx.id}
                      className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h2 className="text-lg font-semibold">
                            <Link href={`/transcriptions/view?id=${tx.id}`} className="hover:underline">
                              {tx.title}
                            </Link>
                          </h2>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{format(txDate, "MMM d, yyyy • h:mma")}</span>
                            <span>•</span>
                            <span>{formatDuration(tx.durationMinutes)}</span>
                            <span>•</span>
                            <span>{badgeFormatter.format(tx.wordCount)} words</span>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("text-xs capitalize", statusBadgeVariant[tx.status])}
                        >
                          {tx.status.replace("-", " ")}
                        </Badge>
                      </div>

                      <div className="mt-3 text-sm text-muted-foreground">
                        {tx.summary ? tx.summary : "No summary yet — open to add highlights."}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {classInfo ? (
                          <Badge variant="secondary" className="text-xs">
                            {classInfo.code}
                          </Badge>
                        ) : null}
                        {tx.tags?.map((tag) => (
                          <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                            <Tag className="h-3 w-3" />
                            {tag}
                          </span>
                        ))}
                        <span className="ml-auto text-xs">
                          Updated {formatDistanceToNow(txDate, { addSuffix: true })}
                        </span>
                        <Button asChild variant="link" size="sm" className="ml-auto px-0">
                          <Link href={`/transcriptions/view?id=${tx.id}`}>Open transcript</Link>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
