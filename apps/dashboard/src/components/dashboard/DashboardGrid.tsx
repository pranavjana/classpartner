"use client";

import UpcomingSessionsCard from "./UpcomingSessionsCard";
import WeeklyUsageCard from "./WeeklyUsageCard";
import ClassesOverviewCard from "./ClassesOverviewCard";
import RecentTranscriptionsCard from "./RecentTranscriptionsCard";

export default function DashboardGrid() {
  return (
    <main className="p-4 lg:p-6">
      <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-4 auto-rows-[minmax(192px,auto)] gap-4">
        <UpcomingSessionsCard className="lg:col-span-2" />
        <WeeklyUsageCard className="lg:col-span-2" />
        <ClassesOverviewCard className="lg:col-span-2" />
        <RecentTranscriptionsCard className="lg:col-span-2" />
      </div>
    </main>
  );
}
