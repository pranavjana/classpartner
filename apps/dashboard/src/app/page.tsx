// import { AppSidebar } from "@/components/app-sidebar"
// import {
//   Breadcrumb,
//   BreadcrumbItem,
//   BreadcrumbLink,
//   BreadcrumbList,
//   BreadcrumbPage,
//   BreadcrumbSeparator,
// } from "@/components/ui/breadcrumb"
// import { Separator } from "@/components/ui/separator"
// import {
//   SidebarInset,
//   SidebarProvider,
//   SidebarTrigger,
// } from "@/components/ui/sidebar"

// export default function Page() {
//   return (
//     <SidebarProvider>
//       <AppSidebar />
//       <SidebarInset>
//         <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
//           <div className="flex items-center gap-2 px-4">
//             <SidebarTrigger className="-ml-1" />
//             <Separator
//               orientation="vertical"
//               className="mr-2 data-[orientation=vertical]:h-4"
//             />
//             <Breadcrumb>
//               <BreadcrumbList>
//                 <BreadcrumbItem className="hidden md:block">
//                   <BreadcrumbLink href="#">
//                     Building Your Application
//                   </BreadcrumbLink>
//                 </BreadcrumbItem>
//                 <BreadcrumbSeparator className="hidden md:block" />
//                 <BreadcrumbItem>
//                   <BreadcrumbPage>Data Fetching</BreadcrumbPage>
//                 </BreadcrumbItem>
//               </BreadcrumbList>
//             </Breadcrumb>
//           </div>
//         </header>
//         <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
//           <div className="grid auto-rows-min gap-4 md:grid-cols-3">
//             <div className="bg-muted/50 aspect-video rounded-xl" />
//             <div className="bg-muted/50 aspect-video rounded-xl" />
//             <div className="bg-muted/50 aspect-video rounded-xl" />
//           </div>
//           <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
//         </div>
//       </SidebarInset>
//     </SidebarProvider>
//   )
// }

"use client";

import React, { useState, useEffect } from "react";
import {
  Mic,
  Square,
  CalendarDays,
  Settings,
  Search,
  ChevronRight,
  Clock,
  Bell,
} from "lucide-react";

// External sidebar (your version)
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import DashboardGrid from "@/components/dashboard/DashboardGrid"; 
import DashboardHeader from "@/components/dashboard/DashboardHeader";


// shadcn/ui primitives
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Charts
import { AreaChart, Area, XAxis, Tooltip as RTooltip, ResponsiveContainer } from "recharts";

// --- Mock data ---
const classes = [
  { id: 1, name: "EE2010 Circuit Analysis", color: "bg-blue-500", transcriptions: 12 },
  { id: 2, name: "CS3240 Database Systems", color: "bg-green-500", transcriptions: 9 },
  { id: 3, name: "HG1001 Academic Writing", color: "bg-amber-500", transcriptions: 5 },
];

const sessions = [
  { id: 1, title: "EE2010: Lecture 7 - Op-amp stability", time: "2:00 PM", classId: 1 },
  { id: 2, title: "CS3240: Lab 3 Review - SQL Joins", time: "4:30 PM", classId: 2 },
  { id: 3, title: "HG1001: Thesis Structure Workshop", time: "Tomorrow, 10:00 AM", classId: 3 },
];

const recentTranscriptions = [
  { id: 101, title: "EE2010 Lecture 7", date: "Oct 8, 2025", classId: 1 },
  { id: 102, title: "CS3240 Lab 2 Debrief", date: "Oct 7, 2025", classId: 2 },
  { id: 103, title: "HG1001 Workshop 3", date: "Oct 5, 2025", classId: 3 },
];

const chartData = [
  { d: "Mon", duration: 2.1 },
  { d: "Tue", duration: 3.5 },
  { d: "Wed", duration: 1.8 },
  { d: "Thu", duration: 2.9 },
  { d: "Fri", duration: 4.2 },
  { d: "Sat", duration: 1.2 },
  { d: "Sun", duration: 0.8 },
];

// Minimal tweakcn-compatible theme switcher
function useThemeSwitcher() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
      root.removeAttribute("data-theme");
    } else {
      root.classList.toggle("dark", theme === "dark");
      root.setAttribute("data-theme", theme === "dark" ? "brand-dark" : "brand");
    }
  }, [theme]);
  return { theme, setTheme };
}

// Panel container that respects theme tokens & prevents overflow
const Panel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card text-card-foreground border border-border rounded-2xl p-6 flex flex-col overflow-hidden ${className}`}>
    {children}
  </div>
);

// export default function Page() {
//   const [recording, setRecording] = useState(false);
//   const { setTheme } = useThemeSwitcher();

//   const getClassColor = (classId: number) => classes.find((c) => c.id === classId)?.color ?? "bg-zinc-500";

//   return (
//     <TooltipProvider>
//       <div className="w-full min-h-screen bg-background text-foreground">
//         <SidebarProvider>
//           {/* ⟵ Your external sidebar component */}
//           <AppSidebar />

//           <SidebarInset>
//             {/* Top bar with New Transcription button */}
//             <header className="sticky top-0 z-30 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
//               <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
//                 <SidebarTrigger className="-ml-1.5" />

//                 <Button onClick={() => setRecording((r) => !r)} className="rounded-full">
//                   {recording ? <Square className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
//                   {recording ? "End Transcription" : "New Transcription"}
//                 </Button>

//                 <div className="flex-1">
//                   <div className="relative w-full max-w-md">
//                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
//                     <Input placeholder="Search transcripts, classes..." className="pl-9 rounded-full" />
//                   </div>
//                 </div>

//                 {/* Theme menu (tweakcn-friendly) */}
//                 <DropdownMenu>
//                   <DropdownMenuTrigger asChild>
//                     <Button variant="outline" className="rounded-full text-xs">Theme</Button>
//                   </DropdownMenuTrigger>
//                   <DropdownMenuContent align="end" className="w-40">
//                     <DropdownMenuLabel>Appearance</DropdownMenuLabel>
//                     <DropdownMenuSeparator />
//                     <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
//                     <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
//                     <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
//                   </DropdownMenuContent>
//                 </DropdownMenu>

//                 <Tooltip>
//                   <TooltipTrigger asChild>
//                     <Button variant="ghost" size="icon" className="rounded-full"><Bell className="w-4 h-4" /></Button>
//                   </TooltipTrigger>
//                   <TooltipContent>Notifications</TooltipContent>
//                 </Tooltip>
//                 <Avatar className="h-8 w-8"><AvatarImage alt="User" /><AvatarFallback>CP</AvatarFallback></Avatar>
//               </div>
//             </header>

//             {/* Main content grid (bento) */}
//             <main className="p-4 lg:p-6">
//               {/* Rows expand to fit to avoid text overflow */}
//               <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-4 auto-rows-[minmax(192px,auto)] gap-4">
//                 {/* New Transcription (compact) */}
//                 <Panel className="lg:col-span-2">
//                   <h2 className="text-lg font-semibold">New Transcription</h2>
//                   <p className="text-sm text-muted-foreground mb-3">Start a live transcription session.</p>
//                   <div className="flex gap-3">
//                     <Button onClick={() => setRecording((r) => !r)} className="rounded-xl">
//                       {recording ? <Square className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
//                       {recording ? "End Now" : "Start Now"}
//                     </Button>
//                   </div>
//                 </Panel>

//                 {/* Upcoming Sessions */}
//                 <Panel className="lg:col-span-2">
//                   <div className="flex items-center justify-between mb-3">
//                     <h2 className="text-lg font-semibold">Upcoming Sessions</h2>
//                     <Button variant="ghost" size="sm" className="text-xs">View Full Calendar</Button>
//                   </div>
//                   <div className="space-y-3">
//                     {sessions.map((s) => (
//                       <div key={s.id} className="flex items-center gap-3 text-sm">
//                         <div className={`w-2 h-2 rounded-full ${getClassColor(s.classId)}`} />
//                         <span className="font-medium flex-1 truncate">{s.title}</span>
//                         <div className="flex items-center text-muted-foreground">
//                           <Clock className="w-3 h-3 mr-1" />
//                           <span className="text-xs font-mono">{s.time}</span>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 </Panel>

//                 {/* Weekly Usage chart */}
//                 <Panel className="lg:col-span-2 !p-0 overflow-hidden relative min-h-[192px]">
//                   <div className="absolute top-4 left-6 z-10">
//                     <h2 className="text-lg font-semibold">Weekly Usage</h2>
//                     <p className="text-sm text-muted-foreground">Total hours transcribed.</p>
//                   </div>
//                   <ResponsiveContainer width="100%" height="100%">
//                     <AreaChart data={chartData} margin={{ top: 72, right: 0, left: 0, bottom: 8 }}>
//                       <defs>
//                         <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
//                           <stop offset="5%" stopColor="currentColor" stopOpacity={0.15} />
//                           <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
//                         </linearGradient>
//                       </defs>
//                       <Area type="monotone" dataKey="duration" stroke="currentColor" strokeWidth={2} fill="url(#g)" />
//                       <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
//                       <RTooltip
//                         cursor={{ strokeDasharray: "3 3" }}
//                         content={({ payload }) => {
//                           if (payload && payload.length) {
//                             return (
//                               <div className="p-2 bg-popover text-popover-foreground border border-border rounded-lg shadow-md text-xs">
//                                 <p className="font-medium">{`${payload[0].payload.d}: ${payload[0].value} hrs`}</p>
//                               </div>
//                             );
//                           }
//                           return null;
//                         }}
//                       />
//                     </AreaChart>
//                   </ResponsiveContainer>
//                 </Panel>

//                 {/* Classes Overview */}
//                 <Panel className="lg:col-span-2">
//                   <div className="flex items-center justify-between mb-3">
//                     <h2 className="text-lg font-semibold">Classes Overview</h2>
//                     <Button variant="ghost" size="sm" className="text-xs">Manage Classes</Button>
//                   </div>
//                   <div className="space-y-3">
//                     {classes.map((c) => (
//                       <div key={c.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted cursor-pointer">
//                         <div className={`w-3 h-3 rounded-full flex-shrink-0 ${c.color}`} />
//                         <div className="flex-1 min-w-0">
//                           <p className="font-medium text-sm line-clamp-1">{c.name}</p>
//                         </div>
//                         <Badge variant="secondary" className="text-xs font-normal">{c.transcriptions} Transcriptions</Badge>
//                         <ChevronRight className="w-4 h-4 text-muted-foreground" />
//                       </div>
//                     ))}
//                   </div>
//                 </Panel>

//                 {/* Recent Transcriptions */}
//                 <Panel className="lg:col-span-2">
//                   <div className="flex items-center justify-between mb-3">
//                     <h2 className="text-lg font-semibold">Recent Transcriptions</h2>
//                     <Button variant="ghost" size="sm" className="text-xs">Browse All</Button>
//                   </div>
//                   <div className="space-y-3">
//                     {recentTranscriptions.map((t) => (
//                       <div key={t.id} className="flex items-center gap-4">
//                         <div className="p-3 rounded-lg bg-muted"><CalendarDays className="w-5 h-5 text-muted-foreground" /></div>
//                         <div className="flex-1 min-w-0">
//                           <p className="font-medium truncate">{t.title}</p>
//                           <p className="text-xs text-muted-foreground">{t.date}</p>
//                         </div>
//                         <Button variant="default" size="sm">Open</Button>
//                       </div>
//                     ))}
//                   </div>
//                 </Panel>
//               </div>
//             </main>
//           </SidebarInset>
//         </SidebarProvider>
//       </div>
//     </TooltipProvider>
//   );
// }

export default function Page() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DashboardHeader />  {/* ← top bar restored */}
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <DashboardGrid />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}



