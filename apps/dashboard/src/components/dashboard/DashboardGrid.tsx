"use client";

import UpcomingSessionsCard from "./UpcomingSessionsCard";
import WeeklyUsageCard from "./WeeklyUsageCard";
import ClassesOverviewCard from "./ClassesOverviewCard";
import RecentTranscriptionsCard from "./RecentTranscriptionsCard";

export default function DashboardGrid() {
  return (
    <div className="mx-auto w-full max-w-7xl grid grid-cols-1 gap-4 lg:grid-cols-4 auto-rows-[minmax(192px,auto)]">
      <UpcomingSessionsCard className="lg:col-span-2" />
      <WeeklyUsageCard className="lg:col-span-2" />
      <ClassesOverviewCard className="lg:col-span-2" />
      <RecentTranscriptionsCard className="lg:col-span-2" />
    </div>
  );
}
