"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ClassDashboardPage from "@/components/classes/ClassDashboardPage";
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
  const { classes, ready } = useClasses();
  const { transcriptions } = useDashboardData();

  const classRecord = React.useMemo(() => {
    if (!classIdOrSlug) return undefined;
    return (
      classes.find((cls) => cls.id === classIdOrSlug) ??
      classes.find((cls) => cls.slug === classIdOrSlug)
    );
  }, [classes, classIdOrSlug]);

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

  if (!classIdOrSlug) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
        No class selected. Choose a class from the sidebar.
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
        Loading class workspace…
      </div>
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
