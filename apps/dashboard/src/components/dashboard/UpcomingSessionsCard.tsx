"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/lib/dashboard/provider";
import { useClasses } from "@/lib/classes/provider";

export default function UpcomingSessionsCard({ className = "" }: { className?: string }) {
  const { upcomingEvents } = useDashboardData();
  const { classes } = useClasses();
  const events = upcomingEvents(4);
  const dots = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-indigo-500"];
  return (
    <div className={`bg-card border border-border rounded-2xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Upcoming Sessions</h2>
        <Button variant="ghost" size="sm" className="text-xs" asChild>
          <Link href="/calendar">View full calendar</Link>
        </Button>
      </div>

      <div className="space-y-3">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No upcoming events. Schedule your next lecture or reminder from the calendar.
          </p>
        ) : (
          events.map((evt, i) => {
            const start = parseISO(evt.start);
            const classInfo = evt.classId ? classes.find((cls) => cls.id === evt.classId) : undefined;
            return (
              <div key={evt.id} className="flex items-center gap-3 text-sm">
                <span className={`h-2 w-2 rounded-full ${dots[i % dots.length]}`} />
                <span className="flex-1 truncate font-medium">
                  {evt.title}
                  {classInfo ? (
                    <span className="ml-2 text-xs text-muted-foreground">({classInfo.code})</span>
                  ) : null}
                </span>
                <div className="flex items-center text-muted-foreground">
                  <Clock className="mr-1 h-3 w-3" />
                  <span className="font-mono text-xs">
                    {evt.allDay ? "All day" : format(start, "EEE • h:mma")}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
