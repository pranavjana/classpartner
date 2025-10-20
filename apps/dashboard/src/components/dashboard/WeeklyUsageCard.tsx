"use client";

import * as React from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip as RTooltip } from "recharts";
import { addDays, format, isSameDay, parseISO, subDays } from "date-fns";
import { useDashboardData } from "@/lib/dashboard/provider";
import { useCssVarColor, useIsDarkMode } from "@/lib/ui/useThemeColors";

export default function WeeklyUsageCard({ className = "" }: { className?: string }) {
  const { transcriptions } = useDashboardData();
  const primaryColor = useCssVarColor("--primary", "hsl(221 83% 53%)");
  const isDarkMode = useIsDarkMode();
  const axisTickColor = isDarkMode ? "rgba(226, 232, 240, 0.92)" : "rgba(15, 23, 42, 0.88)";
  const axisStrokeColor = isDarkMode ? "rgba(148, 163, 184, 0.5)" : "rgba(100, 116, 139, 0.6)";

  const chartData = React.useMemo(() => {
    const today = new Date();
    const start = subDays(today, 6);
    return Array.from({ length: 7 }).map((_, index) => {
      const current = addDays(start, index);
      const totalMinutes = transcriptions
        .filter((tx) => isSameDay(current, parseISO(tx.createdAt)))
        .reduce((acc, tx) => acc + (tx.durationMinutes ?? 0), 0);
      const hours = Math.round((totalMinutes / 60) * 10) / 10;
      return {
        d: format(current, "EEE"),
        duration: hours,
      };
    });
  }, [transcriptions]);

  return (
    <div className={`relative bg-card border border-border rounded-2xl overflow-hidden ${className}`}>
      <div className="p-6 pb-0">
        <h2 className="text-lg font-semibold">Weekly Usage</h2>
        <p className="text-sm text-muted-foreground">Total hours transcribed over the past seven days.</p>
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 12, bottom: 12 }}>
            <defs>
              <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="duration"
              stroke={primaryColor}
              strokeWidth={2}
              fill="url(#usageGradient)"
            />
            <XAxis
              dataKey="d"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: axisTickColor }}
              stroke={axisStrokeColor}
            />
            <RTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ payload }) => {
                if (payload && payload.length) {
                  return (
                    <div className="p-2 bg-popover text-popover-foreground border border-border rounded-md text-xs">
                      {`${payload[0].payload.d}: ${payload[0].value} hrs`}
                    </div>
                  );
                }
                return null;
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
