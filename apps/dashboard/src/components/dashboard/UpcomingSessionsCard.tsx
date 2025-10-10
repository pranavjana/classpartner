"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

type Session = { id: number; title: string; time: string };

const defaultSessions: Session[] = [
  { id: 1, title: "EE2010: Lecture 7 - Op-amp stability", time: "2:00 PM" },
  { id: 2, title: "CS3240: Lab 3 Review - SQL Joins", time: "4:30 PM" },
  { id: 3, title: "HG1001: Thesis Structure Workshop", time: "Tomorrow, 10:00 AM" },
];

export default function UpcomingSessionsCard({
  className = "",
  sessions = defaultSessions,
}: {
  className?: string;
  sessions?: Session[];
}) {
  const dots = ["bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500"];

  return (
    <div className={`bg-card border border-border rounded-2xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Upcoming Sessions</h2>
        <Button variant="ghost" size="sm" className="text-xs">View Full Calendar</Button>
      </div>

      <div className="space-y-3">
        {sessions.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 text-sm">
            <span className={`w-2 h-2 rounded-full ${dots[i % dots.length]}`} />
            <span className="font-medium flex-1 truncate">{s.title}</span>
            <div className="flex items-center text-muted-foreground">
              <Clock className="w-3 h-3 mr-1" />
              <span className="text-xs font-mono">{s.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
