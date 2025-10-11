"use client";

import * as React from "react";
import { addMinutes, format, isSameDay, parseISO, setHours, setMinutes, startOfDay } from "date-fns";
import { useSearchParams } from "next/navigation";
import {
  CalendarIcon,
  Download,
  Filter,
  MapPin,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useDashboardData, type CalendarEvent, type CalendarEventType } from "@/lib/dashboard/provider";
import { useClasses } from "@/lib/classes/provider";

const EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  lecture: "Lecture",
  tutorial: "Tutorial",
  lab: "Lab",
  assessment: "Assessment",
  meeting: "Meeting",
  reminder: "Reminder",
};

export default function CalendarPageClient() {
  const [selectedDay, setSelectedDay] = React.useState<Date>(startOfDay(new Date()));
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [classFilter, setClassFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<CalendarEventType | "all">("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const { events, eventsOn, addEvent, deleteEvent } = useDashboardData();
  const { classes } = useClasses();
  const searchParams = useSearchParams();

  const filteredEventDates = React.useMemo(() => {
    const matchesFilters = (event: CalendarEvent) => {
      if (classFilter !== "all" && event.classId !== classFilter) return false;
      if (typeFilter !== "all" && event.type !== typeFilter) return false;
      if (searchTerm) {
        const needle = searchTerm.toLowerCase();
        const haystack = `${event.title} ${event.description ?? ""} ${event.location ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    };
    const days = new Set<string>();
    events.forEach((event) => {
      if (matchesFilters(event)) {
        days.add(new Date(event.start).toDateString());
      }
    });
    return days;
  }, [classFilter, events, searchTerm, typeFilter]);

  const dayEvents = React.useMemo(() => {
    const eventsForDay = eventsOn(selectedDay).sort(
      (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime()
    );
    return eventsForDay.filter((event) => {
      if (classFilter !== "all" && event.classId !== classFilter) return false;
      if (typeFilter !== "all" && event.type !== typeFilter) return false;
      if (!searchTerm) return true;
      const needle = searchTerm.toLowerCase();
      const haystack = `${event.title} ${event.description ?? ""} ${event.location ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [classFilter, eventsOn, searchTerm, selectedDay, typeFilter]);

  const modifiers = React.useMemo(
    () => ({
      hasEvents: (day: Date) => filteredEventDates.has(day.toDateString()),
    }),
    [filteredEventDates]
  );

  React.useEffect(() => {
    const focusClass = searchParams?.get("focus");
    if (!focusClass) return;
    const nextMatch = events
      .filter((evt) => evt.classId === focusClass)
      .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())[0];
    if (nextMatch) {
      const nextDay = startOfDay(parseISO(nextMatch.start));
      setSelectedDay((current) => (isSameDay(current, nextDay) ? current : nextDay));
    }
  }, [events, searchParams]);

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        const parsed = parseICS(text);
        if (!parsed.length) {
          setFeedback("No events found in calendar file.");
          return;
        }
        parsed.forEach((icsEvent) => addEvent(icsEvent));
        setFeedback(`Imported ${parsed.length} event${parsed.length === 1 ? "" : "s"}.`);
      })
      .catch(() => setFeedback("Failed to import calendar file."))
      .finally(() => {
        if (fileInputRef.current) fileInputRef.current.value = "";
      });
  };

  const handleExport = React.useCallback(
    (scope: "all" | "filtered") => {
      const source =
        scope === "filtered"
          ? events.filter((event) => filteredEventDates.has(new Date(event.start).toDateString()))
          : events;
      if (source.length === 0) {
        setFeedback("No events to export yet.");
        return;
      }
      const ics = buildICS(source);
      const blob = new Blob([ics], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "classpartner-calendar.ics";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setFeedback(`Exported ${source.length} event${source.length === 1 ? "" : "s"} to .ics`);
    },
    [events, filteredEventDates]
  );

  React.useEffect(() => {
    const handleImportTrigger = () => fileInputRef.current?.click();
    const handleExportTrigger = () => handleExport("filtered");
    window.addEventListener("calendar:trigger-import", handleImportTrigger);
    window.addEventListener("calendar:trigger-export", handleExportTrigger);
    return () => {
      window.removeEventListener("calendar:trigger-import", handleImportTrigger);
      window.removeEventListener("calendar:trigger-export", handleExportTrigger);
    };
  }, [handleExport]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Keep track of upcoming lectures, labs, and deadlines across your classes.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={classFilter} onValueChange={(value) => setClassFilter(value)}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="Class filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as CalendarEventType | "all")}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.entries(EVENT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search events..."
                className="h-9 w-[180px]"
              />

              <div className="flex flex-1 justify-end gap-2">
                <Button variant="outline" className="h-9 gap-1" onClick={() => fileInputRef.current?.click()}>
                  <UploadCloud className="h-3.5 w-3.5" />
                  Import .ics
                </Button>
                <Button variant="outline" className="h-9 gap-1" onClick={() => handleExport("filtered")}>
                  <Download className="h-3.5 w-3.5" />
                  Export view
                </Button>
              </div>
            </div>
            {feedback ? <p className="text-xs text-muted-foreground">{feedback}</p> : null}
          </div>

          <div className="flex items-center justify-between pb-4">
            <div>
              <p className="text-sm text-muted-foreground">Selected day</p>
              <p className="text-lg font-semibold">{format(selectedDay, "EEEE, dd MMM yyyy")}</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule event
                </Button>
              </DialogTrigger>
              <CreateEventDialog
                day={selectedDay}
                onSubmit={(payload) => {
                  addEvent(payload);
                  setDialogOpen(false);
                }}
              />
            </Dialog>
          </div>

          <Calendar
            selected={selectedDay}
            onSelect={(date) => {
              if (date) setSelectedDay(startOfDay(date));
            }}
            className="rounded-lg border border-border"
            modifiers={modifiers}
            weekStartsOn={1}
            footer={
              <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary/70" />
                  Has events
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-border" />
                  Free day
                </span>
              </div>
            }
          />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold">Schedule for {format(selectedDay, "MMM d")}</h2>
              <p className="text-xs text-muted-foreground">
                {dayEvents.length ? "Tap an entry for quick actions." : "No events yet — add one from the calendar."}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              {dayEvents.length} events
            </div>
          </div>

          <div className="space-y-3">
            {dayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 py-16 text-center">
                <CalendarIcon className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Nothing scheduled.</p>
                <p className="text-xs text-muted-foreground">Add lectures, tutorials, or custom reminders.</p>
              </div>
            ) : (
              dayEvents.map((evt) => (
                <article
                  key={evt.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">{evt.title}</h3>
                        <Badge variant="outline" className="text-xs capitalize">
                          {EVENT_TYPE_LABEL[evt.type]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {evt.allDay
                          ? "All day"
                          : `${format(parseISO(evt.start), "h:mma")} — ${format(parseISO(evt.end), "h:mma")}`}
                      </p>
                      {evt.description ? (
                        <p className="text-xs text-muted-foreground">{evt.description}</p>
                      ) : null}
                      {evt.location ? (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {evt.location}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteEvent(evt.id)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>

                  {evt.classId ? <Separator className="my-3" /> : null}

                  {evt.classId ? (
                    <p className="text-xs text-muted-foreground">
                      Linked class: <span className="font-medium">{classes.find((c) => c.id === evt.classId)?.code ?? "—"}</span>
                    </p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

type CreateEventFormState = {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  type: CalendarEventType;
  classId?: string;
  allDay: boolean;
};

function CreateEventDialog({ day, onSubmit }: { day: Date; onSubmit: (payload: Omit<CalendarEvent, "id">) => void }) {
  const { classes } = useClasses();
  const [form, setForm] = React.useState<CreateEventFormState>({
    title: "",
    description: "",
    startTime: "14:00",
    endTime: "15:00",
    location: "",
    type: "lecture",
    classId: undefined,
    allDay: false,
  });
  const setField =
    <K extends keyof CreateEventFormState>(key: K) =>
    (value: CreateEventFormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value }));

  const resetForm = () =>
    setForm({
      title: "",
      description: "",
      startTime: "14:00",
      endTime: "15:00",
      location: "",
      type: "lecture",
      classId: undefined,
      allDay: false,
    });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Schedule event</DialogTitle>
        <DialogDescription>Plan lectures, labs, or any reminder tied to {format(day, "EEEE, MMM d")}.</DialogDescription>
      </DialogHeader>

      <form
        className="grid gap-4 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmedTitle = form.title.trim();
          if (!trimmedTitle) return;

          const startParts = form.startTime.split(":").map(Number);
          const endParts = form.endTime.split(":").map(Number);
          const start = form.allDay
            ? startOfDay(day)
            : setMinutes(setHours(day, startParts[0] ?? 0), startParts[1] ?? 0);
          let end = form.allDay
            ? start
            : setMinutes(setHours(day, endParts[0] ?? startParts[0] ?? 0), endParts[1] ?? startParts[1] ?? 0);

          if (!form.allDay && end <= start) {
            end = addMinutes(start, 60);
          }

          const payload = {
            title: trimmedTitle,
            description: form.description.trim() || undefined,
            start: start.toISOString(),
            end: end.toISOString(),
            location: form.location.trim() || undefined,
            type: form.type,
            classId: form.classId,
            allDay: form.allDay,
          };

          onSubmit(payload);
          resetForm();
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="EE2010 Project clinic"
            value={form.title}
            onChange={(event) => setField("title")(event.target.value)}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Details</Label>
          <Textarea
            id="description"
            placeholder="What are you covering, any prep needed?"
            value={form.description}
            onChange={(event) => setField("description")(event.target.value)}
            rows={3}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="Room / Zoom link"
            value={form.location}
            onChange={(event) => setField("location")(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">All-day</Label>
            <Switch checked={form.allDay} onCheckedChange={(checked) => setField("allDay")(checked)} />
          </div>
          {!form.allDay ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="startTime" className="text-xs text-muted-foreground uppercase tracking-wide">
                  Starts
                </Label>
                <Input
                  id="startTime"
                  type="time"
                  value={form.startTime}
                  onChange={(event) => setField("startTime")(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="endTime" className="text-xs text-muted-foreground uppercase tracking-wide">
                  Ends
                </Label>
                <Input
                  id="endTime"
                  type="time"
                  value={form.endTime}
                  onChange={(event) => setField("endTime")(event.target.value)}
                  required
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="type">Type</Label>
          <Select value={form.type} onValueChange={(value) => setField("type")(value as CalendarEventType)}>
            <SelectTrigger id="type">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EVENT_TYPE_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="class">Link to class (optional)</Label>
          <Select value={form.classId ?? ""} onValueChange={(value) => setField("classId")(value || undefined)}>
            <SelectTrigger id="class">
              <SelectValue placeholder="Pick a class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No linked class</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.code} — {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={!form.title.trim()}>
            Save event
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function parseICS(text: string): Omit<CalendarEvent, "id">[] {
  const events: Omit<CalendarEvent, "id">[] = [];
  const blocks = text.split("BEGIN:VEVENT").slice(1);
  blocks.forEach((block) => {
    const body = block.split("END:VEVENT")[0];
    const lines = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const getValue = (key: string) => {
      const line = lines.find((entry) => entry.startsWith(`${key}:`) || entry.startsWith(`${key};`));
      if (!line) return undefined;
      const [, value] = line.split(":");
      return value;
    };

    const summary = getValue("SUMMARY");
    const startRaw = getValue("DTSTART");
    const endRaw = getValue("DTEND");
    if (!summary || !startRaw) return;

    const start = parseIcsTimestamp(startRaw);
    const end = endRaw ? parseIcsTimestamp(endRaw) : start;
    const description = getValue("DESCRIPTION");
    const location = getValue("LOCATION");

    events.push({
      title: summary,
      start,
      end,
      description,
      location,
      type: "reminder",
      allDay: !startRaw.includes("T"),
    });
  });
  return events;
}

function parseIcsTimestamp(raw: string): string {
  const match = raw.match(/(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})Z?)?/);
  if (!match) return new Date().toISOString();
  const [, year, month, day, , hour = "00", minute = "00", second = "00"] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  if (raw.endsWith("Z")) {
    return date.toISOString();
  }
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
}

function buildICS(events: CalendarEvent[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Classpartner//Dashboard//EN"];
  events.forEach((event) => {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@classpartner`);
    lines.push(`SUMMARY:${escapeICS(event.title)}`);
    lines.push(`DTSTART:${formatICSDate(event.start)}`);
    lines.push(`DTEND:${formatICSDate(event.end)}`);
    if (event.location) lines.push(`LOCATION:${escapeICS(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function formatICSDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(
    date.getUTCDate()
  ).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(
    2,
    "0"
  )}${String(date.getUTCSeconds()).padStart(2, "0")}Z`;
}

function escapeICS(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}
