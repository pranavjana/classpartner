"use client";

import * as React from "react";
import { Mic, Search, Bell, CalendarDays, NotebookPen, Settings2, X, BookOpen, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
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
import { useDashboardData } from "@/lib/dashboard/provider";
import { useClasses } from "@/lib/classes/provider";
export default function DashboardHeader({
  onNewTranscription,
}: {
  onNewTranscription?: (context: LaunchOutcome) => void | Promise<void>;
}) {
  const { setTheme } = useThemeSwitcher();
  const { launch, launching, dialog } = useTranscriptionLauncher({ onLaunch: onNewTranscription });
  const router = useRouter();
  const { state } = useSidebar();
  const { transcriptions } = useDashboardData();
  const { classes } = useClasses();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showResults, setShowResults] = React.useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  // Filter results based on search query
  const filteredClasses = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    return classes
      .filter((cls) =>
        cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cls.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 5);
  }, [classes, searchQuery]);

  const filteredTranscriptions = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    return transcriptions
      .filter((t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.summary && t.summary.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .slice(0, 5);
  }, [transcriptions, searchQuery]);

  const hasResults = filteredClasses.length > 0 || filteredTranscriptions.length > 0;

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectResult = (path: string) => {
    router.push(path);
    setShowResults(false);
    setSearchQuery("");
  };

  return (
    <header className="sticky top-0 z-30 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      {dialog}
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
        <div
          className="transition-all duration-200 ease-linear"
          style={{
            marginLeft: state === "collapsed" ? "-0.375rem" : "-0.375rem",
            transform: state === "collapsed" ? "translateX(calc(-8rem + 3.5rem))" : "translateX(0)",
          }}
        >
          <SidebarTrigger className="hover:bg-accent" />
        </div>

        <div
          className="flex-1 flex items-center gap-3 transition-all duration-200 ease-linear"
          style={{
            transform: state === "collapsed" ? "translateX(calc(-8rem + 3.5rem))" : "translateX(0)",
          }}
        >
          <Button onClick={launch} className="rounded-full" disabled={launching} aria-busy={launching}>
            <Mic className="w-4 h-4 mr-2" />
            {launching ? "Starting…" : "New Transcription"}
          </Button>

          <div className="flex-1">
            <div className="relative w-full max-w-md" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search transcripts, classes..."
                className="pl-9 rounded-full"
                aria-label="Search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full"
                  onClick={() => {
                    setSearchQuery("");
                    setShowResults(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              {/* Search Results Dropdown */}
              {showResults && searchQuery && (
                <div className="absolute top-full mt-2 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
                  {!hasResults ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No results found.
                    </div>
                  ) : (
                    <>
                      {/* Classes Section */}
                      {filteredClasses.length > 0 && (
                        <div className="border-b border-border">
                          <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                            Classes
                          </div>
                          <div className="py-1">
                            {filteredClasses.map((cls) => (
                              <button
                                key={cls.id}
                                onClick={() => handleSelectResult(`/classes/workspace?classId=${cls.id}`)}
                                className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-center gap-2"
                              >
                                <BookOpen className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{cls.code} — {cls.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Transcriptions Section */}
                      {filteredTranscriptions.length > 0 && (
                        <div>
                          <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                            Transcriptions
                          </div>
                          <div className="py-1">
                            {filteredTranscriptions.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => handleSelectResult(`/transcriptions/view?id=${t.id}`)}
                                className="w-full px-3 py-2 text-left hover:bg-accent transition-colors"
                              >
                                <div className="flex items-start gap-2">
                                  <NotebookPen className="h-4 w-4 text-muted-foreground mt-0.5" />
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="text-sm truncate">{t.title}</span>
                                    {t.createdAt && (
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(t.createdAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => router.push("/")}
                  >
                    <Home className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Home</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => router.push("/calendar")}
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Calendar</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => router.push("/transcriptions/new")}
                  >
                    <NotebookPen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Manual note</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => openGeneralSettingsDialog()}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
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
      </div>
    </header>
  );
}
