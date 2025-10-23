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
        <Card className="border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold">{record.title}</CardTitle>
            <CardDescription>
              Captured on {format(createdAt, "EEEE, dd MMM yyyy • h:mma")} {classInfo ? (
                <>
                  — linked to {" "}
                  <Link href={`/classes/${classInfo.slug}`} className="font-medium underline underline-offset-4">
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
                  <Link href={`/classes/${classInfo.slug}`} className="flex items-center gap-1 text-primary">
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

function formatDuration(minutes: number) {
  if (!minutes) return "—";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  return `${hrs} hr ${mins} min`;
}
