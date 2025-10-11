"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Modifiers = {
  hasEvents?: (day: Date) => boolean;
};

export type CalendarProps = {
  selected?: Date;
  onSelect?: (day: Date | undefined) => void;
  className?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  modifiers?: Modifiers;
  footer?: React.ReactNode;
};

export function Calendar({ selected, onSelect, className, weekStartsOn = 1, modifiers, footer }: CalendarProps) {
  const today = React.useMemo(() => new Date(), []);
  const [month, setMonth] = React.useState<Date>(selected ?? today);

  React.useEffect(() => {
    if (selected) setMonth(selected);
  }, [selected]);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const weekdays = Array.from({ length: 7 }, (_, i) => format(addDays(startOfWeek(today, { weekStartsOn }), i), "EEE"));

  const handleSelect = (day: Date) => {
    onSelect?.(day);
  };

  return (
    <div className={cn("p-3", className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold">{format(monthStart, "MMMM yyyy")}</div>
        <button
          type="button"
          className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {weekdays.map((wd) => (
          <div key={wd} className="text-center text-[0.8rem] text-muted-foreground">
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const outside = !isSameMonth(day, monthStart);
          const isSelected = selected ? isSameDay(day, selected) : false;
          const hasEvents = modifiers?.hasEvents?.(day) ?? false;
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => handleSelect(day)}
              className={cn(
                "relative h-9 w-9 rounded-md text-sm transition-colors",
                "flex items-center justify-center",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && !outside && "hover:bg-muted",
                outside && "text-muted-foreground/60"
              )}
            >
              {format(day, "d")}
              {hasEvents ? (
                <span
                  className={cn(
                    "absolute bottom-1 h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-primary-foreground" : "bg-primary/70"
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {footer ? <div className="mt-2">{footer}</div> : null}
    </div>
  );
}
