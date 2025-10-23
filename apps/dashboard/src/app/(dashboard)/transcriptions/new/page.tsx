"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { Mic, NotebookPen, Shield, StickyNote, Trash2 } from "lucide-react";
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

type QuickNote = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

const QUICK_NOTES_KEY = "cp_manual_quick_notes";

export default function NewTranscriptionPage() {
  const { launch, launching, dialog } = useTranscriptionLauncher();
  const { addTranscription } = useDashboardData();
  const { classes } = useClasses();
  const [manualTitle, setManualTitle] = React.useState("");
  const [manualClassId, setManualClassId] = React.useState<string | undefined>();
  const [manualNotes, setManualNotes] = React.useState("");
  const [savedDraft, setSavedDraft] = React.useState(false);
  const [quickNotes, setQuickNotes] = React.useState<QuickNote[]>([]);
  const [noteTitle, setNoteTitle] = React.useState("");
  const [noteBody, setNoteBody] = React.useState("");
  const [noteSaved, setNoteSaved] = React.useState(false);

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

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(QUICK_NOTES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as QuickNote[];
        setQuickNotes(parsed);
      }
    } catch (error) {
      console.warn("Failed to hydrate manual quick notes", error);
    }
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(QUICK_NOTES_KEY, JSON.stringify(quickNotes));
    } catch (error) {
      console.warn("Failed to persist manual quick notes", error);
    }
  }, [quickNotes]);

  const handleCreateQuickNote = React.useCallback(() => {
    const title = noteTitle.trim();
    const content = noteBody.trim();
    if (!title && !content) return;

    const note: QuickNote = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `note-${Date.now()}`,
      title: title || "Untitled note",
      content,
      createdAt: new Date().toISOString(),
    };

    setQuickNotes((prev) => [note, ...prev].slice(0, 12));
    setNoteTitle("");
    setNoteBody("");
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2200);
  }, [noteBody, noteTitle]);

  const handleDeleteQuickNote = React.useCallback((id: string) => {
    setQuickNotes((prev) => prev.filter((note) => note.id !== id));
  }, []);

  const handleUseQuickNote = React.useCallback(
    (note: QuickNote) => {
      setManualNotes((prev) => {
        const base = prev.trim();
        if (!base) return note.content;
        return `${base}\n\n${note.content}`;
      });
    },
    []
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {dialog}
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
                value={manualClassId ?? "__unassigned"}
                onValueChange={(value) => setManualClassId(value === "__unassigned" ? undefined : value)}
              >
                <SelectTrigger id="manual-class">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned">Unassigned</SelectItem>
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

            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <StickyNote className="h-3.5 w-3.5 text-primary" />
                  Quick scratchpad
                </h3>
                {noteSaved ? <span className="text-[11px] text-emerald-600">Note saved</span> : null}
              </div>

              <div className="grid gap-2">
                <Input
                  value={noteTitle}
                  onChange={(event) => setNoteTitle(event.target.value)}
                  placeholder="Title"
                />
                <Textarea
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                  placeholder="Jot down reminders or action items…"
                  rows={4}
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{noteBody.length} characters</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateQuickNote}
                    disabled={!noteTitle.trim() && !noteBody.trim()}
                  >
                    Save scratch note
                  </Button>
                </div>
              </div>

              <Separator />

              {quickNotes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No scratch notes yet. Capture a thought and save it here.</p>
              ) : (
                <div className="space-y-3">
                  {quickNotes.map((note) => (
                    <article key={note.id} className="rounded-md border border-border/60 bg-background/80 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{note.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Saved {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDeleteQuickNote(note.id)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                      {note.content ? (
                        <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{note.content}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleUseQuickNote(note)}
                        >
                          Send to highlights
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

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
