"use client";

import * as React from "react";
import { Mic, NotebookPen, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTranscriptionLauncher } from "@/lib/transcription/use-launcher";
import { useDashboardData } from "@/lib/dashboard/provider";
import { useClasses } from "@/lib/classes/provider";

export default function NewTranscriptionPage() {
  const { launch, launching } = useTranscriptionLauncher();
  const { addTranscription } = useDashboardData();
  const { classes } = useClasses();
  const [manualTitle, setManualTitle] = React.useState("");
  const [manualClassId, setManualClassId] = React.useState<string | undefined>();
  const [manualNotes, setManualNotes] = React.useState("");
  const [savedDraft, setSavedDraft] = React.useState(false);

  const handleManualCapture = React.useCallback(() => {
    const title = manualTitle.trim();
    if (!title) return;

    const now = new Date();
    addTranscription({
      title,
      classId: manualClassId,
      createdAt: now.toISOString(),
      durationMinutes: 25,
      wordCount: Math.max(1800, manualNotes.length * 4),
      status: "draft",
      summary: manualNotes.trim() || "Planned notes captured manually.",
      tags: ["manual-entry"],
    });

    setManualTitle("");
    setManualClassId(undefined);
    setManualNotes("");
    setSavedDraft(true);
    setTimeout(() => setSavedDraft(false), 2500);
  }, [addTranscription, manualClassId, manualNotes, manualTitle]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Start a transcription</h1>
        <p className="text-sm text-muted-foreground">
          Launch the overlay to capture a live lecture or log a manual summary when audio is unavailable.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Mic className="h-5 w-5 text-primary" />
              Live capture
            </CardTitle>
            <CardDescription>
              Opens the always-on-top overlay. Make sure the microphone input is ready before you start.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={launch} disabled={launching} aria-busy={launching} size="lg" className="w-full">
              {launching ? "Starting capture…" : "Launch transcription overlay"}
            </Button>
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <ul className="list-inside list-disc space-y-1">
                <li>Overlay starts recording immediately and streams the transcript in real time.</li>
                <li>Use the overlay controls to pause, bookmark segments, or send them to AI assistants.</li>
                <li>
                  Sessions automatically appear under <Badge variant="secondary">Recents</Badge> once they finish.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <NotebookPen className="h-5 w-5 text-primary" />
              Manual entry
            </CardTitle>
            <CardDescription>For classes where recording is disallowed or when you want quick field notes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="manual-title">Session title</Label>
              <Input
                id="manual-title"
                value={manualTitle}
                placeholder="EE2010 consult with Prof. Tan"
                onChange={(event) => setManualTitle(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manual-class">Class (optional)</Label>
              <Select
                value={manualClassId ?? ""}
                onValueChange={(value) => setManualClassId(value || undefined)}
              >
                <SelectTrigger id="manual-class">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.code} — {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manual-notes">Highlights</Label>
              <Textarea
                id="manual-notes"
                value={manualNotes}
                onChange={(event) => setManualNotes(event.target.value)}
                placeholder="Summarise key takeaways, action items, or next steps."
                rows={6}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={!manualTitle.trim()}
              onClick={handleManualCapture}
            >
              Save as draft note
            </Button>

            {savedDraft ? (
              <p className="text-xs text-emerald-600">Saved! Find it under Recents to polish later.</p>
            ) : null}

            <Separator />

            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
              <Shield className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                Draft notes never leave your device. Upgrade them to a full transcription later by attaching audio or
                enriching them with AI summaries.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
