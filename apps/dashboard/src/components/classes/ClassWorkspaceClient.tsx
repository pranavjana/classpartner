"use client";

import Link from "next/link";
import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ClassDashboardPage from "@/components/classes/ClassDashboardPage";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ClassItem } from "@/lib/classes/provider";
import { useClasses } from "@/lib/classes/provider";
import { useDashboardData } from "@/lib/dashboard/provider";
import { getClassDashboardDetail, SEED_CLASS_IDS } from "@/lib/seed/data";
import type {
  ClassDashboardDetail,
  ClassStats,
  Note,
  Session,
  Permissions,
} from "@/lib/types/class-dashboard";
import { startOfWeek, format } from "date-fns";

export default function ClassWorkspaceClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classIdOrSlug = searchParams?.get("classId");
  const { classes: activeClasses, archivedClasses, ready, archiveClass } = useClasses();
  const { transcriptions } = useDashboardData();

  const transcriptionCounts = React.useMemo(() => {
    return transcriptions.reduce<Record<string, number>>((acc, tx) => {
      if (!tx.classId) return acc;
      acc[tx.classId] = (acc[tx.classId] ?? 0) + 1;
      return acc;
    }, {});
  }, [transcriptions]);

  const [restoreBusyId, setRestoreBusyId] = React.useState<string | null>(null);
  const [restoreError, setRestoreError] = React.useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = React.useState<string | null>(null);

  const classRecord = React.useMemo(() => {
    if (!classIdOrSlug) return undefined;
    return (
      activeClasses.find((cls) => cls.id === classIdOrSlug) ??
      activeClasses.find((cls) => cls.slug === classIdOrSlug)
    );
  }, [activeClasses, classIdOrSlug]);

  const archivedRecord = React.useMemo(() => {
    if (!classIdOrSlug) return undefined;
    return (
      archivedClasses.find((cls) => cls.id === classIdOrSlug) ??
      archivedClasses.find((cls) => cls.slug === classIdOrSlug)
    );
  }, [archivedClasses, classIdOrSlug]);

  const handleRestore = React.useCallback(
    async (id: string, opts: { select?: boolean } = {}) => {
      setRestoreError(null);
      setRestoreMessage(null);
      setRestoreBusyId(id);
      const result = await archiveClass(id, false);
      setRestoreBusyId(null);
      if (!result.success) {
        setRestoreError(result.error ?? "Failed to restore class");
        return false;
      }
      if (opts.select) {
        router.replace(`/classes/workspace?classId=${id}`);
        router.refresh();
      } else {
        setRestoreMessage("Class restored.");
      }
      return true;
    },
    [archiveClass, router]
  );

  const seededDetail = React.useMemo(
    () => (classIdOrSlug ? getClassDashboardDetail(classIdOrSlug) : undefined),
    [classIdOrSlug]
  );

  const derivedDetail = React.useMemo<ClassDashboardDetail | null>(() => {
    if (!classRecord && !seededDetail) {
      return null;
    }

    const id = classRecord?.id ?? seededDetail?.classInfo.id ?? classIdOrSlug ?? "unknown";
    const code = classRecord?.code ?? seededDetail?.classInfo.code ?? id.toUpperCase();
    const name =
      classRecord?.name ??
      seededDetail?.classInfo.name ??
      code
        .split("-")
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" ");

    const classInfo: ClassDashboardDetail["classInfo"] = {
      id,
      name,
      code,
      icon: seededDetail?.classInfo.icon ?? "book",
      colour: seededDetail?.classInfo.colour ?? "#2563eb",
      semester: seededDetail?.classInfo.semester ?? "Current semester",
      createdAt: seededDetail?.classInfo.createdAt ?? new Date().toISOString(),
      updatedAt: seededDetail?.classInfo.updatedAt ?? new Date().toISOString(),
      pinned: classRecord ? SEED_CLASS_IDS.includes(classRecord.id) : false,
      metadata: seededDetail?.classInfo.metadata ?? {},
    };

    const classTranscriptions = transcriptions.filter((tx) => tx.classId === id);
    const sessions: Session[] =
      seededDetail?.sessions ??
      classTranscriptions.map((tx) => ({
        id: tx.id,
        classId: id,
        title: tx.title,
        date: tx.createdAt,
        durationMinutes: tx.durationMinutes ?? 0,
        status: tx.status === "completed" ? "ready" : tx.status === "in-progress" ? "processing" : "failed",
        lastEditedAt: tx.createdAt,
        wordCount: tx.wordCount,
      }));

    const notes: Note[] = seededDetail?.notes ?? [];

    const stats: ClassStats =
      seededDetail?.stats ?? buildStatsFromTranscriptions(classTranscriptions);

    const permissions: Permissions =
      seededDetail?.permissions ?? { canEdit: true, canDelete: true, canShare: true };

    return {
      classInfo,
      stats,
      sessions,
      notes,
      permissions,
    };
  }, [classRecord, classIdOrSlug, seededDetail, transcriptions]);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
        Loading class workspace…
      </div>
    );
  }

  if (!classIdOrSlug) {
    return (
      <ClassWorkspaceLanding
        activeClasses={activeClasses}
        archivedClasses={archivedClasses}
        transcriptionCounts={transcriptionCounts}
        onRestore={handleRestore}
        restoreBusyId={restoreBusyId}
        restoreMessage={restoreMessage}
        restoreError={restoreError}
      />
    );
  }

  if (archivedRecord) {
    return (
      <ArchivedClassNotice
        classItem={archivedRecord}
        onRestore={() => handleRestore(archivedRecord.id, { select: true })}
        restoring={restoreBusyId === archivedRecord.id}
        error={restoreError}
      />
    );
  }

  if (!derivedDetail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-sm text-muted-foreground">
        <p>That class is not available yet.</p>
        <button
          type="button"
          className="rounded-full border border-border px-4 py-2 text-xs"
          onClick={() => router.back()}
        >
          Go back
        </button>
      </div>
    );
  }

  return <ClassDashboardPage detail={derivedDetail} />;
}

type ClassWorkspaceLandingProps = {
  activeClasses: ClassItem[];
  archivedClasses: ClassItem[];
  transcriptionCounts: Record<string, number>;
  onRestore: (id: string, opts?: { select?: boolean }) => Promise<boolean>;
  restoreBusyId: string | null;
  restoreMessage: string | null;
  restoreError: string | null;
};

function ClassWorkspaceLanding({
  activeClasses,
  archivedClasses,
  transcriptionCounts,
  onRestore,
  restoreBusyId,
  restoreMessage,
  restoreError,
}: ClassWorkspaceLandingProps) {
  const hasActive = activeClasses.length > 0;
  const hasArchived = archivedClasses.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-10 overflow-y-auto p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Classes workspace</h1>
        <p className="text-sm text-muted-foreground">
          Select a class to dive into its dashboard, or restore one you previously archived.
        </p>
      </div>

      {restoreMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {restoreMessage}
        </div>
      ) : null}

      {restoreError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {restoreError}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Active classes
          </h2>
          <p className="text-sm text-muted-foreground">
            These classes appear in your workspace and sidebar.
          </p>
        </div>

        {hasActive ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeClasses.map((cls) => {
              const transcriptCount = transcriptionCounts[cls.id] ?? 0;
              return (
                <Card key={cls.id} className="border-border/80">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-base">
                      {cls.code} — {cls.name}
                    </CardTitle>
                    <CardDescription>
                      {transcriptCount} transcription{transcriptCount === 1 ? "" : "s"} captured
                    </CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button asChild size="sm">
                      <Link href={`/classes/workspace?classId=${cls.id}`}>Open workspace</Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed border-border/80">
            <CardHeader>
              <CardTitle className="text-base">No active classes yet</CardTitle>
              <CardDescription>
                Add a class from the sidebar to start collecting transcripts and notes.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Archived classes
          </h2>
          <p className="text-sm text-muted-foreground">
            Archived classes are hidden from the workspace but keep their transcripts intact. Restore them
            whenever you need to pick things back up.
          </p>
        </div>

        {hasArchived ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {archivedClasses.map((cls) => {
              const transcriptCount = transcriptionCounts[cls.id] ?? 0;
              const restoring = restoreBusyId === cls.id;
              return (
                <Card key={`arch-${cls.id}`} className="border-border/60">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-base">
                      {cls.code} — {cls.name}
                    </CardTitle>
                    <CardDescription>
                      {transcriptCount} transcription{transcriptCount === 1 ? "" : "s"} saved
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>This class is archived. Restore it to bring it back into your workspace.</p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={restoring}
                      onClick={() => {
                        void onRestore(cls.id);
                      }}
                    >
                      {restoring ? "Restoring…" : "Restore"}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed border-border/80">
            <CardHeader>
              <CardTitle className="text-base">No archived classes</CardTitle>
              <CardDescription>
                Archive a class from its dashboard settings when you want to hide it without deleting anything.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>
    </div>
  );
}

type ArchivedClassNoticeProps = {
  classItem: ClassItem;
  onRestore: () => Promise<boolean>;
  restoring: boolean;
  error: string | null;
};

function ArchivedClassNotice({ classItem, onRestore, restoring, error }: ArchivedClassNoticeProps) {
  const label =
    classItem.code && classItem.code.trim()
      ? `${classItem.code} — ${classItem.name}`
      : classItem.name;

  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <Card className="max-w-md border-border/70">
        <CardHeader className="space-y-2 text-center">
          <CardTitle>{label}</CardTitle>
          <CardDescription>This class is archived and hidden from your workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Restore it to continue adding new transcripts or reviewing past sessions.</p>
          {error ? <p className="text-destructive">{error}</p> : null}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            onClick={() => {
              void onRestore();
            }}
            disabled={restoring}
          >
            {restoring ? "Restoring…" : "Restore class"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function buildStatsFromTranscriptions(transcriptions: { durationMinutes?: number; createdAt: string }[]): ClassStats {
  if (transcriptions.length === 0) {
    return {
      totalMinutes: 0,
      sessionCount: 0,
      avgSessionMinutes: 0,
      weeklyTimeSeries: [],
    };
  }

  const totalMinutes = transcriptions.reduce(
    (sum, tx) => sum + (tx.durationMinutes ?? 0),
    0
  );
  const sessionCount = transcriptions.length;
  const avgSessionMinutes = Math.round(totalMinutes / sessionCount);
  const lastSessionAt = transcriptions
    .map((tx) => tx.createdAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  const byWeek = new Map<string, number>();
  transcriptions.forEach((tx) => {
    const week = startOfWeek(new Date(tx.createdAt), { weekStartsOn: 1 });
    const key = format(week, "yyyy-MM-dd");
    byWeek.set(key, (byWeek.get(key) ?? 0) + (tx.durationMinutes ?? 0));
  });

  const weeklyTimeSeries = Array.from(byWeek.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, minutes]) => ({ date, minutes }));

  return {
    totalMinutes,
    sessionCount,
    avgSessionMinutes,
    lastSessionAt,
    weeklyTimeSeries,
  };
}
