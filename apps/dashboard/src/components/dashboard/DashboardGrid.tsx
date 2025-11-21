"use client";

import HeroCard from "./HeroCard";
import ClassesOverviewCard from "./ClassesOverviewCard";
import RecentTranscriptionsCard from "./RecentTranscriptionsCard";

export default function DashboardGrid() {
  return (
    <div className="mx-auto mt-3 w-full max-w-7xl space-y-6">
      {/* Hero Card - Full width at top */}
      <HeroCard />

      {/* Grid for remaining cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 auto-rows-[minmax(192px,auto)]">
        <ClassesOverviewCard className="lg:col-span-2" />
        <RecentTranscriptionsCard className="lg:col-span-2" />
      </div>
    </div>
  );
}
