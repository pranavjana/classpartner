import { Suspense } from "react";
import ClassWorkspaceClient from "@/components/classes/ClassWorkspaceClient";

export default function ClassWorkspacePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading class workspace…</div>}>
      <ClassWorkspaceClient />
    </Suspense>
  );
}
