"use client";

import * as React from "react";
import { Mic, Search, Bell } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useThemeSwitcher } from "@/lib/ui/useThemeSwitcher";

export default function DashboardHeader({
  onNewTranscription,
}: {
  onNewTranscription?: () => void | Promise<void>;
}) {
  const { setTheme } = useThemeSwitcher();
  const [launching, setLaunching] = React.useState(false);

  const launchNew = React.useCallback(async () => {
    if (launching) return;
    setLaunching(true);
    try {
      // 1) If parent provided a handler, use that
      if (onNewTranscription) {
        await onNewTranscription();
        return;
      }

      // 2) Use Electron preload bridge only (no deep-link fallback)
      const desktop = typeof window !== "undefined" ? window.desktop : undefined;

      if (desktop?.openOverlay) {
        await desktop.openOverlay();
        await desktop.startTranscription?.();
        return;
      }

      // 3) Not running inside the desktop shell
      alert("Please run the desktop app to start a transcription.");
    } catch (e) {
      console.error("Failed to launch new transcription:", e);
    } finally {
      setLaunching(false);
    }
  }, [onNewTranscription, launching]);

  return (
    <header className="sticky top-0 z-30 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
        <SidebarTrigger className="-ml-1.5" />

        <Button onClick={launchNew} className="rounded-full" disabled={launching} aria-busy={launching}>
          <Mic className="w-4 h-4 mr-2" />
          {launching ? "Starting…" : "New Transcription"}
        </Button>

        <div className="flex-1">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search transcripts, classes..."
              className="pl-9 rounded-full"
              aria-label="Search"
            />
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="rounded-full text-xs">
              Theme
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Bell className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Avatar className="h-8 w-8">
          <AvatarImage alt="User" />
          <AvatarFallback>CP</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
