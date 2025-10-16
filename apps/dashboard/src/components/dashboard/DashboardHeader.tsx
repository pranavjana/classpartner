"use client";

import * as React from "react";
import { Mic, Search, Bell, CalendarDays, NotebookPen, Settings2, Download } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { useTranscriptionLauncher, type LaunchOutcome } from "@/lib/transcription/use-launcher";
import { openGeneralSettingsDialog } from "@/components/sidebar/GeneralSettingsDialogue";

export default function DashboardHeader({
  onNewTranscription,
}: {
  onNewTranscription?: (context: LaunchOutcome) => void | Promise<void>;
}) {
  const { setTheme } = useThemeSwitcher();
  const { launch, launching, dialog } = useTranscriptionLauncher({ onLaunch: onNewTranscription });
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      {dialog}
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
        <SidebarTrigger className="-ml-1.5" />

        <Button onClick={launch} className="rounded-full" disabled={launching} aria-busy={launching}>
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

        <div className="hidden lg:flex items-center gap-2 pr-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-1 rounded-full border border-border px-3 text-xs"
                  onClick={() => router.push("/calendar")}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Calendar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Jump to the calendar</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-1 rounded-full border border-border px-3 text-xs"
                  onClick={() => router.push("/transcriptions/new")}
                >
                  <NotebookPen className="h-3.5 w-3.5" />
                  Manual note
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create a manual transcription draft</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-1 rounded-full border border-border px-3 text-xs"
                  onClick={() => openGeneralSettingsDialog()}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Settings
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open general settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-1 rounded-full border border-border px-3 text-xs"
                  onClick={() => window.dispatchEvent(new Event("calendar:trigger-export"))}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export .ics
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download filtered calendar as .ics</TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
