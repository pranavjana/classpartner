"use client";

import * as React from "react";
import { Banana, Calendar, House, BookOpen, Settings2, Frame, PieChart, Map, Landmark, Utensils } from "lucide-react";
import { NavMain } from "@/components/sidebar/nav-main";
import { NavProjects } from "@/components/sidebar/nav-projects";
import { NavUser } from "@/components/sidebar/nav-user";
//import { TeamSwitcher } from "@/components/team-switcher";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { NavClasses } from "@/components/sidebar/nav-classes";

// sample data (same as yours, but remove the 'Classes' item from navMain)
const data = {
  user: { name: "shadcn", email: "m@example.com", avatar: "/avatars/shadcn.jpg" },
  teams: [{ name: "Classpartner", logo: Banana }],
  navMain: [
    { title: "Home", url: "#", icon: House, isActive: true },
    { title: "Calendar", url: "#", icon: Calendar },
    {
      title: "Transcriptions",
      url: "#",
      icon: BookOpen,
      items: [
        { title: "New Transcription", url: "#" },
        { title: "Recents", url: "#" },
        { title: "Model Context", url: "#" },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        { title: "General", url: "#" },
        { title: "Team", url: "#" },
        { title: "Billing", url: "#" },
        { title: "Limits", url: "#" },
      ],
    },
  ],
  projects: [
    { name: "Design Engineering", url: "#", icon: Frame },
    { name: "Sales & Marketing", url: "#", icon: PieChart },
    { name: "Travel", url: "#", icon: Map },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
    <div className="flex h-8 items-center gap-2 px-2 text-sm font-medium">
     <Utensils className="h-4 w-4" />
      <span className="truncate">Classpartner</span>
    </div>
  </SidebarHeader>

      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavClasses />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

