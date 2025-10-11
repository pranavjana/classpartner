"use client";

import * as React from "react";
import Link from "next/link";
import { format, parseISO, isAfter } from "date-fns";
import { Mic, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useClasses } from "@/lib/classes/provider";
import { useDashboardData } from "@/lib/dashboard/provider";

export default function ClassDetailClient({ slug }: { slug: string }) {
  const { classes } = useClasses();
  const { transcriptionsForClass, events } = useDashboardData();
  const cls = classes.find((item) => item.slug === slug);

  if (!cls) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
          <h1 className="text-xl font-semibold">Class not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn&#39;t locate this class. It may have been removed or renamed.
          </p>
          <Button asChild className="mt-4">
            <Link href="/">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const relatedTranscriptions = transcriptionsForClass(cls.id);
  const relatedEvents = events.filter((evt) => evt.classId === cls.id);
  const upcomingEvents = relatedEvents
    .filter((evt) => isAfter(parseISO(evt.end), new Date()))
    .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime());
  const pastTranscriptions = [...relatedTranscriptions].sort(
    (a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {cls.code}
          <span className="ml-2 text-base font-normal text-muted-foreground">{cls.name}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage materials, upcoming sessions, and captured transcriptions for this module.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
            <div>
              <CardTitle className="text-xl">Upcoming schedule</CardTitle>
              <CardDescription>Lectures, labs, and reminders linked to this class.</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={{ pathname: "/calendar", query: { focus: cls.id } }}>Open calendar</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet. Add one from the calendar to see it here.</p>
            ) : (
              upcomingEvents.map((evt) => (
                <div key={evt.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                  <div>
                    <p className="font-medium">{evt.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {evt.allDay ? "All day" : `${format(parseISO(evt.start), "EEE, MMM d • h:mma")}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {evt.type}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>Jump straight into capture or note taking.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full gap-2">
              <Link href="/transcriptions/new">
                <Mic className="h-4 w-4" /> Start transcription
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full gap-2">
              <Link href="/transcriptions/new">
                <NotebookPen className="h-4 w-4" /> Add manual notes
              </Link>
            </Button>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Link every completed transcript back to {cls.code} automatically when you capture through the overlay.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-xl">Recent transcriptions</CardTitle>
            <CardDescription>Summaries and drafts tied to this module.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/transcriptions">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {pastTranscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transcripts yet. Start a session to see them here.</p>
          ) : (
            pastTranscriptions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div>
                  <p className="font-medium">{tx.title}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(tx.createdAt), "MMM d, yyyy")}</p>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/transcriptions/${tx.id}`}>Open</Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

