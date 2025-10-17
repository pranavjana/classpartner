"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TranscriptionDetailClient from "@/components/pages/TranscriptionDetailClient";

export default function TranscriptionViewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
            <h1 className="text-xl font-semibold">Loading transcript…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please wait while we prepare the session details.
            </p>
          </div>
        </div>
      }
    >
      <TranscriptionViewContent />
    </Suspense>
  );
}

function TranscriptionViewContent() {
  const searchParams = useSearchParams();
  const id = searchParams?.get("id") ?? undefined;

  if (!id) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
          <h1 className="text-xl font-semibold">Select a transcription</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a session from the dashboard or class view to see its full transcript and AI notes.
          </p>
        </div>
      </div>
    );
  }

  return <TranscriptionDetailClient id={id} />;
}
