"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, FileText, ListFilter, MoreVertical, NotebookPen, Settings2, Upload } from "lucide-react";
import type {
  ClassDashboardDetail,
  ClassStats,
  Note,
  Session,
  SessionStatus,
} from "@/lib/types/class-dashboard";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addWeeks, isWithinInterval, parseISO, startOfWeek, subWeeks, format } from "date-fns";
import { useTranscriptionLauncher } from "@/lib/transcription/use-launcher";
import {
  useDashboardData,
  type TranscriptionRecord,
} from "@/lib/dashboard/provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ClassDashboardPageProps = {
  detail: ClassDashboardDetail;
};

const DEFAULT_TAB = "overview";

export default function ClassDashboardPage({ detail }: ClassDashboardPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    transcriptionsForClass,
    updateTranscription,
    addTranscription,
    deleteTranscription,
  } = useDashboardData();
  const queryTab = searchParams?.get("tab") ?? undefined;
  const [activeTab, setActiveTab] = React.useState<string>(queryTab ?? DEFAULT_TAB);
  const [uploadFeedback, setUploadFeedback] = React.useState<string | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const [renameTarget, setRenameTarget] = React.useState<TranscriptionRecord | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<TranscriptionRecord | null>(null);
  const { launch, launching, dialog } = useTranscriptionLauncher({
    defaultClassId: detail.classInfo.id,
    defaultTitle: `${detail.classInfo.code ?? detail.classInfo.name ?? "Live capture"}`,
    onFallback: (context) => {
      const classId = context.classId ?? detail.classInfo.id;
      router.push(`/transcriptions/new?classId=${classId}`);
    },
  });

  React.useEffect(() => {
    const nextTab = queryTab ?? DEFAULT_TAB;
    setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
  }, [queryTab]);

  React.useEffect(() => {
    if (!renameTarget) {
      setRenameValue("");
    } else {
      setRenameValue(renameTarget.title ?? "");
    }
  }, [renameTarget]);

  const handleTabChange = React.useCallback(
    (value: string) => {
      setActiveTab(value);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (value === DEFAULT_TAB) {
        params.delete("tab");
      } else {
        params.set("tab", value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleUploadAudio = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadFeedback(`Uploading “${file.name}”…`);
    setTimeout(() => {
      setUploadFeedback(`Upload complete. Session created for ${detail.classInfo.code ?? detail.classInfo.id}.`);
    }, 1400);
  };

  const classTranscriptions = React.useMemo(
    () => transcriptionsForClass(detail.classInfo.id),
    [detail.classInfo.id, transcriptionsForClass]
  );

  const derivedSessions: Session[] = React.useMemo(() => {
    if (!classTranscriptions.length) return [];
    const mapStatus = (status: TranscriptionRecord["status"]): SessionStatus => {
      switch (status) {
        case "completed":
          return "ready";
        case "in-progress":
          return "processing";
        default:
          return "ready";
      }
    };

    return classTranscriptions.map((tx) => {
      const segments = tx.segments ?? [];
      const lastSegment = segments.length ? segments[segments.length - 1] : undefined;
      const derivedDuration =
        tx.durationMinutes ||
        (lastSegment?.endMs ? Math.max(1, Math.round(lastSegment.endMs / 60000)) : 0);
      return {
        id: tx.id,
        classId: tx.classId ?? detail.classInfo.id,
        title: tx.title,
        date: tx.createdAt,
        durationMinutes: derivedDuration,
        status: mapStatus(tx.status),
        lastEditedAt: tx.createdAt,
        wordCount: tx.wordCount ?? 0,
      };
    });
  }, [classTranscriptions, detail.classInfo.id]);

  const effectiveSessions = derivedSessions.length ? derivedSessions : detail.sessions;
  const pinnedNotes = detail.notes.filter((note) => note.pinned);
  const recentSessions = [...effectiveSessions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const stats = React.useMemo(() => {
    if (!derivedSessions.length) return detail.stats;
    const totalMinutes = derivedSessions.reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);
    const sessionCount = derivedSessions.length;
    const avgSessionMinutes = sessionCount ? Math.round(totalMinutes / sessionCount) : 0;
    const lastSession = derivedSessions
      .map((session) => session.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    const now = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weeks = Array.from({ length: 8 }, (_, index) => subWeeks(now, 7 - index));
    const weeklyTimeSeries = weeks.map((weekStart) => {
      const weekEnd = addWeeks(weekStart, 1);
      const minutes = derivedSessions
        .filter((session) =>
          isWithinInterval(parseISO(session.date), { start: weekStart, end: weekEnd })
        )
        .reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);
      return { date: weekStart.toISOString(), minutes };
    });

    return {
      totalMinutes,
      sessionCount,
      avgSessionMinutes,
      lastSessionAt: lastSession,
      weeklyTimeSeries,
    } satisfies ClassStats;
  }, [derivedSessions, detail.stats]);

  const handleRenameSession = React.useCallback(
    (id: string, title: string) => {
      updateTranscription(id, { title });
    },
    [updateTranscription]
  );

  const handleDuplicateSession = React.useCallback(
    (id: string) => {
      const original = classTranscriptions.find((tx) => tx.id === id);
      if (!original) return;
      const timestamp = Date.now();
      const duplicateSegments = original.segments
        ? original.segments.map((segment, index) => ({
            ...segment,
            id: `${segment.id ?? `segment-${index}`}-copy-${timestamp}-${index}`,
          }))
        : undefined;
      addTranscription({
        title: `${original.title} (Copy)`,
        classId: original.classId ?? detail.classInfo.id,
        createdAt: new Date().toISOString(),
        durationMinutes: original.durationMinutes ?? 0,
        wordCount: original.wordCount ?? 0,
        status: "draft",
        summary: original.summary,
        tags: original.tags,
        flagged: false,
        content: original.content,
        keyPoints: original.keyPoints,
        actionItems: original.actionItems,
        segments: duplicateSegments,
      });
    },
    [addTranscription, classTranscriptions, detail.classInfo.id]
  );

  const handleDeleteSession = React.useCallback(
    (id: string) => {
      deleteTranscription(id);
    },
    [deleteTranscription]
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      {dialog}
      <input
        ref={uploadInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleUploadAudio}
      />

      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <ClassAvatar colour={detail.classInfo.colour} code={detail.classInfo.code} />
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {detail.classInfo.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {detail.classInfo.semester ?? "Current semester"}
                {detail.classInfo.metadata?.instructor ? ` · ${detail.classInfo.metadata.instructor}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="rounded-full gap-2"
              onClick={launch}
              disabled={launching}
              aria-busy={launching}
            >
              <NotebookPen className="h-4 w-4" />
              {launching ? "Starting…" : "New transcription"}
            </Button>
            <Button
              variant="ghost"
              className="gap-2"
              onClick={() => uploadInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload audio
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Open class settings"
              disabled={!detail.permissions.canEdit}
              onClick={() => handleTabChange("settings")}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More class actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => alert("Rename class (stub)")}>Rename</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => alert("Pin / Unpin class (stub)")}>Pin / Unpin</DropdownMenuItem>
                <DropdownMenuItem disabled={!detail.permissions.canEdit} onSelect={() => alert("Archive class (stub)")}>
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!detail.permissions.canDelete}
                  className="text-destructive focus:text-destructive"
                  onSelect={() => alert("Delete class (stub)")}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {uploadFeedback ? <p className="text-xs text-muted-foreground">{uploadFeedback}</p> : null}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-1 flex-col">
        <TabsList className="self-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings" disabled={!detail.permissions.canEdit && !detail.permissions.canShare}>
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ClassOverviewPanel
            stats={stats}
            recentSessions={recentSessions}
            pinnedNotes={pinnedNotes}
            allNotesCount={detail.notes.length}
            classInfo={detail.classInfo}
          />
        </TabsContent>

        <TabsContent value="sessions">
          <SessionsPanel
            sessions={effectiveSessions}
            transcriptions={classTranscriptions}
            onRenameRequest={(record) => {
              setRenameTarget(record);
              setRenameValue(record.title ?? "");
            }}
            onDuplicate={handleDuplicateSession}
            onDeleteRequest={(record) => setDeleteTarget(record)}
          />
        </TabsContent>

        <TabsContent value="notes">
          <NotesPanel classId={detail.classInfo.id} notes={detail.notes} />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsPanel stats={stats} sessions={effectiveSessions} />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsPanel detail={detail} />
        </TabsContent>
      </Tabs>
      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename session</DialogTitle>
            <DialogDescription>
              Update the title shown in the class dashboard and transcription list.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rename-session">Session title</Label>
            <Input
              id="rename-session"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!renameTarget) return;
                const trimmed = renameValue.trim();
                if (!trimmed || trimmed === renameTarget.title) return;
                handleRenameSession(renameTarget.id, trimmed);
                setRenameTarget(null);
              }}
              disabled={!renameTarget || !renameValue.trim() || renameValue.trim() === renameTarget?.title}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transcription?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.title ?? "this session"}
              </span>{" "}
              and its transcript from the dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                handleDeleteSession(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClassAvatar({ colour, code }: { colour?: string; code?: string }) {
  const background = colour ?? "#6366f1";
  return (
    <div
      aria-hidden
      className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-semibold text-white shadow-sm"
      style={{ background }}
    >
      {(code ?? "CL").slice(0, 2).toUpperCase()}
    </div>
  );
}

type OverviewProps = {
  stats: ClassStats;
  recentSessions: Session[];
  pinnedNotes: Note[];
  allNotesCount: number;
  classInfo: ClassDashboardDetail["classInfo"];
};

function ClassOverviewPanel({ stats, recentSessions, pinnedNotes, allNotesCount, classInfo }: OverviewProps) {
  const [range, setRange] = React.useState<"8w" | "6m">("8w");
  const chartData = stats.weeklyTimeSeries.map((point) => ({
    date: format(new Date(point.date), "MMM d"),
    minutes: point.minutes,
    hours: Math.round((point.minutes / 60) * 10) / 10,
  }));

  const totalHours = Math.round((stats.totalMinutes / 60) * 10) / 10;
  const avgMinutes = Math.round(stats.avgSessionMinutes);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total hours"
          value={`${totalHours.toLocaleString()} h`}
          helper="vs. last 8 weeks"
          trend="up"
        />
        <SummaryCard
          title="Session count"
          value={stats.sessionCount.toString()}
          helper={stats.lastSessionAt ? `Last session ${formatRelative(stats.lastSessionAt)}` : "No sessions yet"}
          trend="steady"
        />
        <SummaryCard title="Avg. session" value={`${avgMinutes} min`} helper="Adjusted weekly" trend="neutral" />
      </div>

      <Card className="border-border">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg">Transcription activity</CardTitle>
            <CardDescription>Minutes captured over the last 8 weeks</CardDescription>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted p-1 text-xs">
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1",
                range === "8w" ? "bg-background font-medium text-foreground" : "text-muted-foreground"
              )}
              onClick={() => setRange("8w")}
            >
              Week
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1",
                range === "6m" ? "bg-background font-medium text-foreground" : "text-muted-foreground"
              )}
              onClick={() => setRange("6m")}
            >
              Month
            </button>
          </div>
        </CardHeader>
        <CardContent className="h-[260px]">
          {chartData.every((point) => point.minutes === 0) ? (
            <EmptyState message="No activity this period" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, left: 10, right: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="classArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis hide domain={[0, (dataMax: number) => Math.max(60, dataMax + 30)]} />
                <RechartsTooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    return (
                      <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-sm">
                        <p>{payload[0].payload.date}</p>
                        <p className="font-medium">{payload[0].payload.minutes} min</p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="minutes" stroke="var(--primary)" fill="url(#classArea)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent sessions</CardTitle>
              <CardDescription>Latest captures for this class</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1" asChild>
              <Link href={`/transcriptions/new?classId=${classInfo.id}`}>
                New transcription
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSessions.length === 0 ? (
              <EmptyState message="No transcriptions yet" ctaHref={`/transcriptions/new?classId=${classInfo.id}`} />
            ) : (
              recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <StatusDot status={session.status} />
                      <span>{session.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(session.date), "dd MMM yyyy, h:mma")} · {formatDuration(session.durationMinutes)}
                    </p>
                  </div>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/transcriptions/view?id=${session.id}`}>Open</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Pinned notes</CardTitle>
            <CardDescription>
              {pinnedNotes.length} / {allNotesCount} notes highlighted for quick access
            </CardDescription>
          </CardHeader>
            <CardContent className="space-y-3">
              {pinnedNotes.length === 0 ? (
                <EmptyState
                  message="No pinned notes yet"
                  ctaHref={`/classes/${classInfo.id}?tab=notes`}
                  ctaLabel="Open notes tab"
                />
              ) : (
                pinnedNotes.slice(0, 4).map((note) => (
                  <Link
                    key={note.id}
                    href={`/notes/${note.id}?classId=${classInfo.id}`}
                    className="block rounded-lg border border-border/70 bg-card/60 p-3 transition hover:border-primary/40"
                  >
                    <p className="text-sm font-medium">{note.title}</p>
                    <p className="text-xs text-muted-foreground">{formatRelative(note.createdAt)}</p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Class details</CardTitle>
              <CardDescription>Meta information and quick links</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {classInfo.metadata?.instructor ? (
                <MetaRow label="Instructor" value={classInfo.metadata.instructor} />
              ) : null}
              {classInfo.metadata?.schedule ? (
                <MetaRow
                  label="Schedule"
                  value={classInfo.metadata.schedule
                    .map((slot) => `${weekdayName(slot.day)} ${slot.start}–${slot.end}`)
                    .join(" · ")}
                />
              ) : null}
              {classInfo.metadata?.defaultLanguage ? (
                <MetaRow label="Default language" value={classInfo.metadata.defaultLanguage.toUpperCase()} />
              ) : null}
              {classInfo.metadata?.meetLink ? (
                <MetaRow
                  label="Meeting link"
                  value={
                    <a className="text-primary underline" href={classInfo.metadata.meetLink} target="_blank" rel="noreferrer">
                      Join call
                    </a>
                  }
                />
              ) : null}
              <MetaRow label="Created" value={format(new Date(classInfo.createdAt), "dd MMM yyyy")} />
              <MetaRow label="Updated" value={format(new Date(classInfo.updatedAt), "dd MMM yyyy")} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

type SessionsPanelProps = {
  sessions: Session[];
  transcriptions: TranscriptionRecord[];
  onRenameRequest: (record: TranscriptionRecord) => void;
  onDuplicate: (id: string) => void;
  onDeleteRequest: (record: TranscriptionRecord) => void;
};

function SessionsPanel({ sessions, transcriptions, onRenameRequest, onDuplicate, onDeleteRequest }: SessionsPanelProps) {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"all" | Session["status"]>("all");
  const [sort, setSort] = React.useState<"date-desc" | "date-asc" | "title" | "duration">("date-desc");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const filtered = React.useMemo(() => {
    return sessions
      .filter((session) => {
        if (status !== "all" && session.status !== status) return false;
        if (!search) return true;
        return session.title.toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => {
        switch (sort) {
          case "date-asc":
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          case "title":
            return a.title.localeCompare(b.title);
          case "duration":
            return b.durationMinutes - a.durationMinutes;
          case "date-desc":
          default:
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
      });
  }, [search, sessions, sort, status]);

  const toggleSelection = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const selectAll = (checked: boolean) => {
    setSelected(checked ? new Set(filtered.map((session) => session.id)) : new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search sessions..."
            className="h-9 w-64"
          />
          <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Date · newest</SelectItem>
              <SelectItem value="date-asc">Date · oldest</SelectItem>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="duration">Duration</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="ghost" size="sm" className="gap-2">
          <ListFilter className="h-4 w-4" />
          Advanced filters
        </Button>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <span className="font-medium">{selected.size} selected</span>
          <Button variant="secondary" size="sm" onClick={() => alert("Bulk delete (stub)")}>
            Delete
          </Button>
          <Button variant="secondary" size="sm" onClick={() => alert("Move sessions (stub)")}>
            Move to class
          </Button>
          <Button variant="secondary" size="sm" onClick={() => alert("Export sessions (stub)")}>
            Export
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">
                <Checkbox
                  aria-label="Select all sessions"
                  checked={selected.size > 0 && selected.size === filtered.length}
                  onCheckedChange={(checked) => selectAll(Boolean(checked))}
                />
              </th>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Duration</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No sessions match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((session) => {
                const isChecked = selected.has(session.id);
                const record = transcriptions.find((tx) => tx.id === session.id);
                const hasRecord = Boolean(record);
                return (
                  <tr key={session.id} className="border-t border-border/60">
                    <td className="px-4 py-3 align-middle">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => toggleSelection(session.id, Boolean(checked))}
                        aria-label={`Select ${session.title}`}
                      />
                    </td>
                    <td className="px-4 py-3 align-middle font-medium">
                      {hasRecord ? (
                        <Link href={`/transcriptions/view?id=${session.id}`} className="hover:underline">
                          {session.title}
                        </Link>
                      ) : (
                        <span>{session.title}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">
                      {format(new Date(session.date), "dd MMM yyyy, h:mma")}
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">
                      {formatDuration(session.durationMinutes)}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      {hasRecord ? null : (
                        <p className="pb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Seed session
                        </p>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Session actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild disabled={!hasRecord}>
                            <Link href={`/transcriptions/view?id=${session.id}`}>Open</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!hasRecord}
                            onSelect={() => {
                              if (!record) return;
                              onRenameRequest(record);
                            }}
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!hasRecord}
                            onSelect={() => {
                              if (!record) return;
                              onDuplicate(record.id);
                            }}
                          >
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            disabled={!hasRecord}
                            onSelect={() => {
                              if (!record) return;
                              onDeleteRequest(record);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing {filtered.length} session{filtered.length === 1 ? "" : "s"}</span>
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => alert("Load more (stub)")}>
          Load more
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

type NotesPanelProps = {
  classId: string;
  notes: Note[];
};

function NotesPanel({ classId, notes }: NotesPanelProps) {
  const pinned = notes.filter((note) => note.pinned);
  const others = notes.filter((note) => !note.pinned);
  const [search, setSearch] = React.useState("");

  const filteredPinned = pinned.filter((note) => note.title.toLowerCase().includes(search.toLowerCase()));
  const filteredOthers = others.filter((note) => note.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button asChild className="gap-2">
            <Link href={`/notes/new?classId=${classId}`}>
              <FileText className="h-4 w-4" />
              New note
            </Link>
          </Button>
          <Button variant="ghost" className="gap-2" onClick={() => alert("Import notes (stub)")}>
            <Upload className="h-4 w-4" />
            Import
          </Button>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search notes..."
          className="h-9 w-full md:w-72"
        />
      </div>

      <div className="space-y-6">
        <NoteSection title="Pinned" notes={filteredPinned} emptyMessage="No pinned notes yet" />
        <NoteSection title="All notes" notes={filteredOthers} emptyMessage="No notes yet — create one" />
      </div>
    </div>
  );
}

function NoteSection({ title, notes, emptyMessage }: { title: string; notes: Note[]; emptyMessage: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{notes.length} item{notes.length === 1 ? "" : "s"}</span>
      </div>
      {notes.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => (
            <Link
              key={note.id}
              href={`/notes/${note.id}?classId=${note.classId}`}
              className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/50"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatRelative(note.createdAt)}</span>
                {note.pinned ? <Badge variant="secondary">Pinned</Badge> : null}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{note.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">Open note →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type AnalyticsPanelProps = {
  stats: ClassStats;
  sessions: Session[];
};

function AnalyticsPanel({ stats, sessions }: AnalyticsPanelProps) {
  const lengthBuckets = React.useMemo(() => {
    const buckets: Record<string, number> = {
      "<30": 0,
      "30-60": 0,
      "60-90": 0,
      ">90": 0,
    };
    sessions.forEach((session) => {
      const minutes = session.durationMinutes;
      if (minutes < 30) buckets["<30"] += 1;
      else if (minutes < 60) buckets["30-60"] += 1;
      else if (minutes <= 90) buckets["60-90"] += 1;
      else buckets[">90"] += 1;
    });
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [sessions]);

  const weeklyData = stats.weeklyTimeSeries.map((point) => ({
    week: format(new Date(point.date), "dd MMM"),
    minutes: point.minutes,
    hours: Math.round((point.minutes / 60) * 10) / 10,
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Time spent by week</CardTitle>
          <CardDescription>Hours captured in the past eight weeks</CardDescription>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="analyticsArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" axisLine={false} tickLine={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis hide />
              <RechartsTooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  return (
                    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-sm">
                      <p>{payload[0].payload.week}</p>
                      <p className="font-medium">{payload[0].payload.hours} h</p>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="hours" stroke="var(--primary)" fill="url(#analyticsArea)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Session length distribution</CardTitle>
          <CardDescription>Number of sessions that fall into each duration bracket</CardDescription>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lengthBuckets}>
              <XAxis dataKey="range" axisLine={false} tickLine={false} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} />
              <RechartsTooltip
                cursor={{ fill: "hsl(var(--muted)/40%)" }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  return (
                    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-sm">
                      <p>{payload[0].payload.range}</p>
                      <p className="font-medium">{payload[0].payload.count} session(s)</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Activity heatmap</CardTitle>
          <CardDescription>Daily minutes spent transcribing</CardDescription>
        </CardHeader>
        <CardContent className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Heatmap visualisations are coming soon. For now, review the weekly activity and session distribution charts above.
        </CardContent>
      </Card>
    </div>
  );
}

type SettingsPanelProps = {
  detail: ClassDashboardDetail;
};

function SettingsPanel({ detail }: SettingsPanelProps) {
  const { classInfo, permissions } = detail;
  const [name, setName] = React.useState(classInfo.name);
  const [code, setCode] = React.useState(classInfo.code ?? "");
  const [semester, setSemester] = React.useState(classInfo.semester ?? "");
  const [language, setLanguage] = React.useState(classInfo.metadata?.defaultLanguage ?? "en");
  const [diarisation, setDiarisation] = React.useState(true);
  const [autoNaming, setAutoNaming] = React.useState("{date} — {title}");
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!permissions.canEdit) return;
    setFeedback("Settings saved (stub).");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">General</CardTitle>
            <CardDescription>Update the core details for this class.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="class-name">Name</Label>
              <Input
                id="class-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!permissions.canEdit}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="class-code">Code</Label>
              <Input
                id="class-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={!permissions.canEdit}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="class-semester">Semester</Label>
              <Input
                id="class-semester"
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
                disabled={!permissions.canEdit}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Defaults</CardTitle>
            <CardDescription>Configure how new transcriptions behave.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="class-language">Default language</Label>
              <Input
                id="class-language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                disabled={!permissions.canEdit}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
              <div>
                <p className="text-sm font-medium">Speaker diarisation</p>
                <p className="text-xs text-muted-foreground">Separate speakers automatically in transcripts.</p>
              </div>
              <Switch checked={diarisation} onCheckedChange={setDiarisation} disabled={!permissions.canEdit} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="auto-naming">Auto naming pattern</Label>
              <Input
                id="auto-naming"
                value={autoNaming}
                onChange={(event) => setAutoNaming(event.target.value)}
                disabled={!permissions.canEdit}
              />
              <p className="text-xs text-muted-foreground">Use tokens like {'{date}'} or {'{title}'}.</p>
            </div>
          </CardContent>
        </Card>

        {feedback ? <p className="text-xs text-muted-foreground">{feedback}</p> : null}
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={!permissions.canEdit}>
            Save changes
          </Button>
          <Button type="button" variant="ghost" disabled={!permissions.canEdit} onClick={() => setFeedback("Reverted changes (stub)")}>
            Cancel
          </Button>
        </div>
      </form>

      <div className="space-y-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Sharing</CardTitle>
            <CardDescription>Manage access to this class workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {permissions.canShare ? (
              <Button variant="secondary" onClick={() => alert("Invite member (stub)")}>
                Invite member
              </Button>
            ) : (
              <p>Only owners can manage sharing for this class.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Danger zone</CardTitle>
            <CardDescription>Archive or permanently delete this class.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button variant="outline" className="justify-start" onClick={() => alert("Archive class (stub)")}>
              Archive class
            </Button>
            <Button
              variant="destructive"
              className="justify-start"
              disabled={!permissions.canDelete}
              onClick={() => alert("Delete class (stub)")}
            >
              Delete class
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, helper, trend }: { title: string; value: string; helper: string; trend: "up" | "steady" | "neutral" }) {
  return (
    <Card className="border-border">
      <CardContent className="space-y-2 p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{helper}</p>
        <div className="text-xs text-emerald-500">
          {trend === "up" ? "▲ Trending up" : trend === "steady" ? "● Stable" : "–"}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusDot({ status }: { status: Session["status"] }) {
  const colours: Record<Session["status"], string> = {
    ready: "bg-emerald-500",
    processing: "bg-amber-500",
    failed: "bg-destructive",
  };
  return <span className={cn("h-2 w-2 rounded-full", colours[status])} aria-hidden />;
}

function StatusBadge({ status }: { status: Session["status"] }) {
  const variants: Record<Session["status"], "secondary" | "outline" | "destructive"> = {
    ready: "secondary",
    processing: "outline",
    failed: "destructive",
  };
  const labels: Record<Session["status"], string> = {
    ready: "Ready",
    processing: "Processing",
    failed: "Failed",
  };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function EmptyState({ message, ctaHref, ctaLabel }: { message: string; ctaHref?: string; ctaLabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
      <p>{message}</p>
      {ctaHref ? (
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href={ctaHref}>
            {ctaLabel ?? "Take action"}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function formatDuration(minutes: number) {
  if (!minutes) return "0 min";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  return `${hrs} hr ${mins} min`;
}

function formatRelative(dateIso: string) {
  const diff = Date.now() - new Date(dateIso).getTime();
  const ONE_DAY = 1000 * 60 * 60 * 24;
  if (diff < ONE_DAY) return "Today";
  if (diff < ONE_DAY * 2) return "Yesterday";
  const days = Math.round(diff / ONE_DAY);
  return `${days} days ago`;
}

function weekdayName(day: number) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[day] ?? "";
}
import { Checkbox } from "@/components/ui/checkbox";
