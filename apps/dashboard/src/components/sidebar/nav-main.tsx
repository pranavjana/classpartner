"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export type NavItem = {
  title: string;
  url?: string;
  icon?: LucideIcon;
  isActive?: boolean;
  action?: string;
  items?: NavItem[];
};

type NavMainProps = {
  items: NavItem[];
  /**
   * Hook for custom item behaviour.
   * Return true to prevent the default navigation.
   */
  onLeafClick?: (item: NavItem) => boolean;
};

export function NavMain({ items, onLeafClick }: NavMainProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const hasChildren = Boolean(item.items?.length);

          if (!hasChildren) {
            return (
              <SidebarMenuItem key={item.title}>
                <LeafButton item={item} onLeafClick={onLeafClick} />
              </SidebarMenuItem>
            );
          }

          return (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title} isActive={item.isActive}>
                    {item.icon ? <item.icon /> : null}
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <LeafButton item={subItem} onLeafClick={onLeafClick} isSubItem />
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

type LeafButtonProps = {
  item: NavItem;
  onLeafClick?: (item: NavItem) => boolean;
  isSubItem?: boolean;
};

function LeafButton({ item, onLeafClick, isSubItem }: LeafButtonProps) {
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      if (onLeafClick?.(item)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [item, onLeafClick]
  );

  if (isSubItem) {
    if (item.url) {
      return (
        <SidebarMenuSubButton asChild isActive={item.isActive}>
          <Link href={item.url} onClick={handleClick}>
            {item.icon ? <item.icon /> : null}
            <span>{item.title}</span>
          </Link>
        </SidebarMenuSubButton>
      );
    }

    return (
      <SidebarMenuSubButton asChild isActive={item.isActive}>
        <button type="button" onClick={handleClick}>
          {item.icon ? <item.icon /> : null}
          <span>{item.title}</span>
        </button>
      </SidebarMenuSubButton>
    );
  }

  if (item.url) {
    return (
      <SidebarMenuButton asChild tooltip={item.title} isActive={item.isActive}>
        <Link href={item.url} onClick={handleClick}>
          {item.icon ? <item.icon /> : null}
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    );
  }

  return (
    <SidebarMenuButton asChild tooltip={item.title} isActive={item.isActive}>
      <button type="button" onClick={handleClick}>
        {item.icon ? <item.icon /> : null}
        <span>{item.title}</span>
      </button>
    </SidebarMenuButton>
  );
}
