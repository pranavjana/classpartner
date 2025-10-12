"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Banana, Calendar, House, BookOpen, Settings2, Utensils } from "lucide-react";
import { NavMain, type NavItem } from "@/components/sidebar/nav-main";
import { NavUser } from "@/components/sidebar/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavClasses } from "@/components/sidebar/nav-classes";
import { openGeneralSettingsDialog } from "@/components/sidebar/GeneralSettingsDialogue";

type NavItemConfig = Omit<NavItem, "isActive" | "items"> & { items?: NavItemConfig[] };

const NAV_MAIN_CONFIG: NavItemConfig[] = [
  { title: "Home", url: "/", icon: House },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  {
    title: "Transcriptions",
    icon: BookOpen,
    items: [
      { title: "Recents", url: "/transcriptions" },
      { title: "New capture", url: "/transcriptions/new" },
      { title: "Model context", url: "/transcriptions/context" },
    ],
  },
  {
    title: "Settings",
    icon: Settings2,
    items: [{ title: "General", action: "open-general-settings" }],
  },
];

const data = {
  user: { name: "shadcn", email: "m@example.com", avatar: "/avatars/shadcn.jpg" },
  teams: [{ name: "Classpartner", logo: Banana }],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const navMainItems = React.useMemo(() => annotateNavItems(NAV_MAIN_CONFIG, pathname), [pathname]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex h-8 items-center gap-2 px-2 text-sm font-medium">
          <Utensils className="h-4 w-4" />
          <span className="truncate">Classpartner</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          items={navMainItems}
          onLeafClick={(item) => {
            if (item.action === "open-general-settings") {
              openGeneralSettingsDialog();
              return true;
            }
            return false;
          }}
        />
        <NavClasses />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

function annotateNavItems(config: NavItemConfig[], pathname: string): NavItem[] {
  return config.map((item) => {
    const children = item.items ? annotateNavItems(item.items, pathname) : undefined;
    const isDirectMatch = item.url ? pathname === item.url : false;
    const hasActiveChild = children?.some((child) => child.isActive) ?? false;

    return {
      ...item,
      items: children,
      isActive: isDirectMatch || hasActiveChild,
    };
  });
}
