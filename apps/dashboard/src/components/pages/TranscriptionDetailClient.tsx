"use client";

import * as React from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowLeft, BookmarkCheck, Flag, MapPin, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { TagInput } from "@/components/ui/tag-input";
import { useDashboardData } from "@/lib/dashboard/provider";
import type { TranscriptionRecord, TranscriptSegment } from "@/lib/dashboard/provider";
import { useClasses } from "@/lib/classes/provider";

const STATUS_OPTIONS = [
  { value: "completed", label: "Mark as completed" },
  { value: "in-progress", label: "Resume in overlay" },
  { value: "draft", label: "Save as draft" },
];

export default function TranscriptionDetailClient({ id }: { id: string }) {
  const { transcriptions, updateTranscription } = useDashboardData();
  const { classes } = useClasses();
  const record = transcriptions.find((tx) => tx.id === id);

  const [summary, setSummary] = React.useState(record?.summary ?? "");
  const [tagList, setTagList] = React.useState<string[]>(record?.tags ?? []);
  const [saving, setSaving] = React.useState(false);
  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    transcriptions.forEach((tx) => tx.tags?.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [transcriptions]);

  React.useEffect(() => {
    setSummary(record?.summary ?? "");
    setTagList(record?.tags ?? []);
  }, [record?.summary, record?.tags]);

  const isLostRecap = record?.tags?.includes("lost-recap");
  const relatedRecaps = React.useMemo(() => {
    if (!record?.sessionId) return [];
    return transcriptions
      .filter(
        (tx) =>
          tx.id !== record.id &&
          tx.sessionId === record.sessionId &&
          tx.tags?.includes("lost-recap")
      )
      .map((entry) => ({
        entry,
        payload: parseLostRecapContent(entry),
      }))
      .filter(
        (item): item is { entry: TranscriptionRecord; payload: LostRecapPayload } =>
          Boolean(item.payload)
      )
      .sort((a, b) => (a.payload.markerMs ?? 0) - (b.payload.markerMs ?? 0));
  }, [record?.id, record?.sessionId, transcriptions]);

  if (!record) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
          <h1 className="text-xl font-semibold">Transcript not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The transcription you are looking for does not exist. It may have been removed.
          </p>
          <Button asChild className="mt-4">
            <Link href="/transcriptions">Back to all transcriptions</Link>
          </Button>
        </div>
      </div>
    );
  }

  const createdAt = parseISO(record.createdAt);
  const classInfo = record.classId ? classes.find((cls) => cls.id === record.classId) : undefined;
  const handleSave = async () => {
    setSaving(true);
    try {
      const cleaned = tagList.map((tag) => tag.trim()).filter(Boolean);
      updateTranscription(record.id, {
        summary: summary.trim() || undefined,
        tags: cleaned.length ? cleaned : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (status: typeof record.status) => {
    updateTranscription(record.id, { status });
  };

  const toggleFlag = () => {
    updateTranscription(record.id, { flagged: !record.flagged });
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/transcriptions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to all
          </Link>
        </Button>
        <Badge variant="outline" className="text-xs capitalize">
          {record.status.replace("-", " ")}
        </Badge>
        {record.flagged ? (
          <Badge variant="destructive" className="text-xs">
            Needs attention
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <OverlayTranscriptPreview record={record} captureDate={createdAt} />
          <Card className="border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold">{record.title}</CardTitle>
            <CardDescription>
              Captured on {format(createdAt, "EEEE, dd MMM yyyy • h:mma")} {classInfo ? (
                <>
                  — linked to {" "}
                  <Link
                    href={`/classes/workspace?classId=${classInfo.id}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {classInfo.code}
                  </Link>
                </>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Summary</h2>
                <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving}>
                  <PenLine className="mr-2 h-4 w-4" />
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
              <Textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={8}
                placeholder="Capture the key takeaways, decisions, and any follow-up tasks."
              />
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tags</h2>
              <TagInput
                value={tagList}
                onChange={setTagList}
                suggestions={allTags}
                placeholder="Add a tag and press Enter…"
              />
              {tagList.length ? (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {tagList.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No tags yet — add a few to help with search.</p>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Key points</h2>
              {record.keyPoints?.length ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {record.keyPoints.map((point, index) => (
                    <li key={`${record.id}-kp-${index}`} className="rounded-md border border-border/60 bg-muted/20 p-2">
                      {point}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Key takeaways will appear here once the AI assistant finishes processing this transcript.
                </p>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Action items</h2>
              {record.actionItems?.length ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {record.actionItems.map((item, index) => (
                    <li key={`${record.id}-ai-${index}`} className="flex items-start gap-2">
                      <span>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tasks, deadlines, and follow-ups will be listed once they are generated or added manually.
                </p>
              )}
            </section>

            <Separator />

            {!isLostRecap && relatedRecaps.length ? (
              <>
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Moments of confusion
                  </h2>
                  <div className="space-y-3">
                    {relatedRecaps.map(({ entry: recap, payload }) => (
                      <div
                        key={recap.id}
                        className="rounded-lg border border-border bg-muted/30 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            Recap @ {formatMarkerClock(payload.markerMs)}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => jumpToLostMoment(payload.markerMs, record.sessionId)}
                          >
                            Jump
                          </Button>
                        </div>
                        {payload.structured?.summary?.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {payload.structured.summary.slice(0, 3).map((item, idx) => (
                              <li key={`${recap.id}-sum-${idx}`}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Recap saved — open it from the overlay for full detail.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
                <Separator />
              </>
            ) : null}

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Full transcript</h2>
              {record.content ? (
                <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
                  <p className="whitespace-pre-wrap">{record.content}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  The transcript will appear here once the capture is processed. If you just finished recording, keep
                  this page open — content usually lands within a few moments.
                </p>
              )}
            </section>
          </CardContent>
        </Card>

        </div>

        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick actions</CardTitle>
              <CardDescription>Update the status or flag the session for review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {STATUS_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={record.status === option.value ? "default" : "outline"}
                  className="w-full justify-start gap-2"
                  onClick={() => handleStatusChange(option.value as typeof record.status)}
                >
                  <BookmarkCheck className="h-4 w-4" />
                  {option.label}
                </Button>
              ))}
              <Button variant={record.flagged ? "destructive" : "outline"} className="w-full justify-start gap-2" onClick={toggleFlag}>
                <Flag className="h-4 w-4" />
                {record.flagged ? "Clear follow-up flag" : "Mark for follow-up"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Metadata</CardTitle>
              <CardDescription>Key information pulled from the overlay session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Duration</span>
                <span className="font-medium">{formatDuration(record.durationMinutes)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Word count</span>
                <span className="font-medium">{new Intl.NumberFormat("en-US").format(record.wordCount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Segments</span>
                <span className="font-medium">{record.segments?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Captured</span>
                <span className="font-medium">{format(createdAt, "MMM d, yyyy")}</span>
              </div>
              {classInfo ? (
                <div className="flex items-start justify-between gap-2">
                  <span>Linked class</span>
                  <Link href={`/classes/workspace?classId=${classInfo.id}`} className="flex items-center gap-1 text-primary">
                    <MapPin className="h-3.5 w-3.5" />
                    {classInfo.code}
                  </Link>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

type OverlayTranscriptPreviewProps = {
  record: TranscriptionRecord;
  captureDate: Date;
};

function OverlayTranscriptPreview({ record, captureDate }: OverlayTranscriptPreviewProps) {
  const segments: TranscriptSegment[] = record.segments?.length
    ? record.segments
    : buildSegmentsFromText(record.fullText ?? record.content);
  const transcriptWordCount = record.wordCount
    ? record.wordCount
    : segments.reduce((total, segment) => total + segment.text.split(/\s+/).filter(Boolean).length, 0);
  const highlightFrom = Math.max(0, segments.length - 5);
  const endedAtSource = segments.length
    ? segments[segments.length - 1]?.endMs ?? segments[segments.length - 1]?.startMs
    : undefined;
  const endedAt = endedAtSource ? new Date(endedAtSource) : captureDate;
  const endedLabel = Number.isNaN(endedAt.getTime()) ? null : format(endedAt, "MMM d, yyyy • h:mma");

  return (
    <Card className="border border-slate-800 bg-[#05060a] text-slate-100 shadow-2xl">
      <CardHeader className="border-b border-white/5 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-slate-500/80">Overlay transcript</p>
            <CardTitle className="text-xl text-white">Session preview</CardTitle>
            <CardDescription className="text-slate-400">
              Captured via the floating overlay{endedLabel ? ` • ${endedLabel}` : ""}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em]">
              <span
                className={`h-2 w-2 rounded-full ${record.status === "in-progress" ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`}
              />
              {record.status === "in-progress" ? "Live" : "Session ended"}
            </span>
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
              {record.sessionId ? `Session ${record.sessionId}` : "No session link"}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-6 text-xs">
          <OverlayStat label="Duration" value={formatDuration(record.durationMinutes)} />
          <OverlayStat label="Words" value={new Intl.NumberFormat("en-US").format(transcriptWordCount)} />
          <OverlayStat label="Segments" value={segments.length || 0} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 shadow-inner">
          {segments.length ? (
            <div className="max-h-[420px] overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-y-2 text-[0.95rem] leading-relaxed">
                {segments.map((segment, index) => {
                  const isRecent = index >= highlightFrom;
                  return (
                    <span
                      key={segment.id ?? `${segment.text}-${index}`}
                      className={`mr-2 inline-flex rounded-md px-2 py-1 transition ${
                        isRecent
                          ? "bg-indigo-500/20 text-white"
                          : "bg-transparent text-slate-200"
                      }`}
                    >
                      {segment.text}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[140px] items-center justify-center text-sm text-slate-400">
              <p>No transcript segments were synced from the overlay for this session.</p>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500">
          This preview mirrors the transcript window that the overlay displayed before the capture was closed.
        </p>
      </CardContent>
    </Card>
  );
}

function OverlayStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500">{label}</span>
      <span className="text-base font-semibold text-white">{value}</span>
    </div>
  );
}

function buildSegmentsFromText(text?: string | null): TranscriptSegment[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({ id: `ft-${index}`, text: line }));
}

function formatDuration(minutes: number) {
  if (!minutes) return "—";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  return `${hrs} hr ${mins} min`;
}

type LostRecapPayload = {
  markerMs?: number;
  flaggedAt?: number;
  structured?: {
    summary?: string[];
    prerequisites?: string[];
    steps?: string[];
  };
};

function parseLostRecapContent(record: TranscriptionRecord): LostRecapPayload | null {
  if (!record.content) return null;
  try {
    const parsed = JSON.parse(record.content) as LostRecapPayload & { type?: string };
    if (parsed && (parsed.type === "lost-recap" || parsed.markerMs !== undefined)) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function formatMarkerClock(ms?: number) {
  if (typeof ms !== "number" || ms < 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function jumpToLostMoment(markerMs?: number, sessionId?: string) {
  if (typeof window === "undefined" || typeof markerMs !== "number") return;
  const bus = (window as unknown as { bus?: { jumpTo?: (detail: unknown) => void } }).bus;
  bus?.jumpTo?.({ startMs: markerMs, sessionId });
}
