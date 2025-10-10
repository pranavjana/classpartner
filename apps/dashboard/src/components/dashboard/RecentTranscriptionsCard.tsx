"use client";

import * as React from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

type Tx = { id: number; title: string; date: string };

const defaultTx: Tx[] = [
  { id: 101, title: "EE2010 Lecture 7", date: "Oct 8, 2025" },
  { id: 102, title: "CS3240 Lab 2 Debrief", date: "Oct 7, 2025" },
  { id: 103, title: "HG1001 Workshop 3", date: "Oct 5, 2025" },
];

export default function RecentTranscriptionsCard({
  className = "",
  items = defaultTx,
}: {
  className?: string;
  items?: Tx[];
}) {
  return (
    <div className={`bg-card border border-border rounded-2xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Transcriptions</h2>
        <Button variant="ghost" size="sm" className="text-xs">
          Browse All
        </Button>
      </div>

      <div className="space-y-4">
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.date}</p>
            </div>
            <Button size="sm">Open</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
