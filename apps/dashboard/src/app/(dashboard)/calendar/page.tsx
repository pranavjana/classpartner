import { Suspense } from "react";
import CalendarPageClient from "@/components/pages/CalendarPageClient";

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading calendar…</div>}>
      <CalendarPageClient />
    </Suspense>
  );
}
