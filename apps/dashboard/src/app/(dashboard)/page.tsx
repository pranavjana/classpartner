"use client";

import DashboardGrid from "@/components/dashboard/DashboardGrid";

export default function DashboardHomePage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <DashboardGrid />
    </div>
  );
}
