"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useClasses } from "@/lib/classes/provider";
import { useDashboardData } from "@/lib/dashboard/provider";

const LAST_CLASS_KEY = "cp_last_transcription_class";
const UNASSIGNED_VALUE = "__none";

export type LaunchContext = {
  classId?: string;
  sessionTitle?: string;
};

export type LaunchOutcome = LaunchContext & {
  recordId?: string;
};

type DesktopBridge = {
  openOverlay?: () => Promise<void> | void;
  startTranscription?: (
    meta?: { classId?: string | null; recordId?: string | null; title?: string | null }
  ) => Promise<{ success: boolean; error?: string } | void> | void;
};

type LaunchOptions = {
  onLaunch?: (context: LaunchOutcome) => void | Promise<void>;
  onFallback?: (context: LaunchOutcome) => void | Promise<void>;
  defaultClassId?: string;
  defaultTitle?: string;
};

export function useTranscriptionLauncher(options: LaunchOptions = {}) {
  const { onLaunch, onFallback, defaultClassId, defaultTitle } = options;
  const { classes } = useClasses();
  const { addTranscription, updateTranscription, activeRecordId, setActiveRecordId } = useDashboardData();

  const [launching, setLaunching] = React.useState(false);
  const launchingRef = React.useRef(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedClassId, setSelectedClassId] = React.useState<string>(UNASSIGNED_VALUE);
  const [sessionTitle, setSessionTitle] = React.useState("");
  const [lastClassId, setLastClassId] = React.useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return window.localStorage.getItem(LAST_CLASS_KEY) ?? undefined;
  });

  const activeRecordRef = React.useRef<string | null>(activeRecordId);
  React.useEffect(() => {
    activeRecordRef.current = activeRecordId;
  }, [activeRecordId]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastClassId) {
      window.localStorage.setItem(LAST_CLASS_KEY, lastClassId);
    } else {
      window.localStorage.removeItem(LAST_CLASS_KEY);
    }
  }, [lastClassId]);

  const buildContext = React.useCallback(
    (classId: string | undefined, title?: string): LaunchContext => {
      const trimmedTitle = title?.trim();
      if (trimmedTitle) return { classId, sessionTitle: trimmedTitle };
      const fallbackTitle =
        defaultTitle?.trim() ??
        `Live capture — ${format(new Date(), "MMM d, h:mma")}`;
      return { classId, sessionTitle: fallbackTitle };
    },
    [defaultTitle]
  );

  const startWithContext = React.useCallback(
    async (classIdInput: string | undefined, titleInput?: string) => {
      if (launchingRef.current) return;
      const normalizedClassId = classIdInput === UNASSIGNED_VALUE ? undefined : classIdInput;
      const context = buildContext(normalizedClassId, titleInput);

      const desktop: DesktopBridge | undefined =
        typeof window !== "undefined"
          ? (window as unknown as { desktop?: DesktopBridge }).desktop
          : undefined;
      const transcriptionBridge = typeof window !== "undefined" ? window.transcription : undefined;

      if (!onLaunch && (!desktop?.openOverlay || !transcriptionBridge?.start)) {
        if (onFallback) {
          await onFallback(context);
        } else {
          alert("Please run the desktop app to start a transcription.");
        }
        return;
      }

      launchingRef.current = true;
      setLaunching(true);
      let recordId: string | undefined;
      try {
        recordId = addTranscription({
          title: context.sessionTitle ?? `Live capture — ${format(new Date(), "MMM d, h:mma")}`,
          classId: context.classId,
          createdAt: new Date().toISOString(),
          durationMinutes: 0,
          wordCount: 0,
          status: "in-progress",
          summary: "Live transcription in progress…",
          tags: ["live-capture"],
        });
        setActiveRecordId(recordId);
        activeRecordRef.current = recordId;

        const enrichedContext: LaunchOutcome = { ...context, recordId };

        if (context.classId) setLastClassId(context.classId);

        if (onLaunch) {
          await onLaunch(enrichedContext);
          return;
        }

        await desktop?.openOverlay?.();
        const startResult = await transcriptionBridge?.start?.({
          classId: context.classId ?? null,
          recordId,
          title: context.sessionTitle ?? null,
        });
        if (startResult && typeof startResult === "object" && "success" in startResult) {
          if (!startResult.success) {
            throw new Error(startResult.error ?? "Failed to start transcription");
          }
        }
      } catch (error) {
        console.error("Failed to launch new transcription:", error);
        if (recordId) {
          updateTranscription(recordId, {
            status: "draft",
            summary: `Launch error: ${error instanceof Error ? error.message : String(error)}`,
          });
          setActiveRecordId(null);
          activeRecordRef.current = null;
        }

        if (onFallback) {
          await onFallback(context);
          return;
        }

        alert("Please run the desktop app to start a transcription.");
      } finally {
        launchingRef.current = false;
        setLaunching(false);
      }
    },
    [addTranscription, buildContext, onFallback, onLaunch, setActiveRecordId, updateTranscription, setLastClassId]
  );

  const handleDialogConfirm = React.useCallback(async () => {
    setDialogOpen(false);
    await startWithContext(selectedClassId, sessionTitle);
    setSessionTitle("");
  }, [selectedClassId, sessionTitle, startWithContext]);

  const handleDialogCancel = React.useCallback(() => {
    setDialogOpen(false);
    setSessionTitle("");
    setSelectedClassId(UNASSIGNED_VALUE);
    setLaunching(false);
  }, []);

  const launch = React.useCallback(() => {
    if (launchingRef.current || launching) return;
    const initialClassId = defaultClassId ?? lastClassId ?? classes[0]?.id ?? UNASSIGNED_VALUE;
    setSelectedClassId(initialClassId);
    const initialTitle = defaultClassId ? defaultTitle?.trim() ?? "" : "";
    setSessionTitle(initialTitle);
    setDialogOpen(true);
  }, [classes, defaultClassId, defaultTitle, lastClassId, launching]);

  const dialog = (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        if (!open) handleDialogCancel();
        else setDialogOpen(true);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start transcription</DialogTitle>
          <DialogDescription>
            Pick the class to store this recording under and optionally add a session title.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="transcription-class">Class</Label>
            <Select
              value={selectedClassId}
              onValueChange={(value) => setSelectedClassId(value)}
            >
              <SelectTrigger id="transcription-class">
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.code} — {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="transcription-title">Session title</Label>
            <Input
              id="transcription-title"
              placeholder="Lecture focus, tutorial, or meeting name"
              value={sessionTitle}
              onChange={(event) => setSessionTitle(event.target.value)}
            />
          </div>

        </div>

        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={handleDialogCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={handleDialogConfirm} disabled={launching}>
            Start capture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { launch, launching, dialog };
}
