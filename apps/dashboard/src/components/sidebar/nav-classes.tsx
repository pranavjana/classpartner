"use client";

import * as React from "react";
import { BookOpen, ChevronRight, MoreHorizontal, Pin, PinOff, Plus } from "lucide-react";
import Link from "next/link";
import { useClasses } from "@/lib/classes/provider";
import { useDashboardData } from "@/lib/dashboard/provider";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function NavClasses() {
  const { ready, classes, pinnedIds, addClass, renameClass, deleteClass, togglePin } = useClasses();
  const { transcriptions } = useDashboardData();

  // dialogs
  const [addOpen, setAddOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");

  const [renameOpen, setRenameOpen] = React.useState(false);
  const [renameId, setRenameId] = React.useState<string | null>(null);
  const [renameCode, setRenameCode] = React.useState("");
  const [renameName, setRenameName] = React.useState("");

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const pinned = classes.filter((c) => pinnedIds.includes(c.id));
  const unpinned = classes.filter((c) => !pinnedIds.includes(c.id));

  const transcriptionCounts = React.useMemo(() => {
    return transcriptions.reduce<Record<string, number>>((acc, tx) => {
      if (!tx.classId) return acc;
      acc[tx.classId] = (acc[tx.classId] ?? 0) + 1;
      return acc;
    }, {});
  }, [transcriptions]);

  function startRename(id: string) {
    const cls = classes.find((x) => x.id === id);
    if (!cls) return;
    setRenameId(id);
    setRenameCode(cls.code);
    setRenameName(cls.name);
    setRenameOpen(true);
  }

  const handleAdd = React.useCallback(() => {
    const c = code.trim();
    const n = name.trim();
    if (!c || !n) return;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now());

    addClass({
      id,
      code: c,
      name: n,
      slug: slugify(`${c}-${n}`),
    });

    setCode("");
    setName("");
    setAddOpen(false);
  }, [code, name, addClass]);

  const handleRenameSave = React.useCallback(() => {
    if (!renameId) return;
    const c = renameCode.trim();
    const n = renameName.trim();
    if (!c || !n) return;

    // Provider expects a patch object
    renameClass(renameId, { code: c, name: n });

    setRenameOpen(false);
    setRenameId(null);
  }, [renameId, renameCode, renameName, renameClass]);

  const handleDelete = React.useCallback(() => {
    if (!deleteId) return;
    deleteClass(deleteId);
    setDeleteOpen(false);
    setDeleteId(null);
  }, [deleteId, deleteClass]);

  return (
    <>
      {/* Pinned */}
      <SidebarGroup>
        <div className="flex items-center justify-between pr-2">
          <SidebarGroupLabel>Pinned</SidebarGroupLabel>
        </div>
        <SidebarMenu>
          {!ready ? (
            <SidebarMenuItem>
              <SidebarMenuButton>
                <span>Loading…</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : pinned.length === 0 ? (
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Pin classes from the list below">
                <Pin className="h-4 w-4" />
                <span>No pinned classes yet</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            pinned.map((cls) => {
              const href = `/classes/workspace?classId=${cls.id}`;
              return (
                <SidebarMenuItem key={`p-${cls.id}`}>
                  <SidebarMenuButton asChild tooltip={`${cls.code} — ${cls.name}`}>
                    <Link href={href} className="flex items-center gap-2">
                      <Pin className="h-4 w-4" />
                      <span className="flex-1 truncate">
                        {cls.code} — {cls.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{transcriptionCounts[cls.id] ?? 0}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })
          )}
        </SidebarMenu>
      </SidebarGroup>

      {/* Classes */}
      <SidebarGroup>
        <div className="flex items-center justify-between pr-2">
          <SidebarGroupLabel>Classes</SidebarGroupLabel>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a class</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid gap-1">
                  <Label htmlFor="code">Module code</Label>
                  <Input
                    id="code"
                    placeholder="e.g., CS3240"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="name">Class name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Database Systems"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={handleAdd} disabled={!code.trim() || !name.trim()}>
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <SidebarMenu>
          {!ready ? (
            <SidebarMenuItem>
              <SidebarMenuButton>
                <span>Loading…</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : classes.length === 0 ? (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setAddOpen(true)} tooltip="Add your first class">
                <BookOpen className="h-4 w-4" />
                <span>No classes yet — add one</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Open classes workspace">
                  <Link href="/classes/workspace" className="flex w-full items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span>Classes</span>
                  </Link>
                </SidebarMenuButton>
                <CollapsibleTrigger asChild>
                  <SidebarMenuAction
                    aria-label="Toggle classes list"
                    className="text-muted-foreground"
                  >
                    <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuAction>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {/* Pinned inside Classes */}
                    {pinned.length > 0 && (
                      <>
                        <div className="px-2 pt-1 text-xs text-muted-foreground">Pinned</div>
                        {pinned.map((cls) => (
                          <SidebarMenuSubItem key={`subp-${cls.id}`}>
                            <div className="flex items-center gap-1">
                              <SidebarMenuSubButton asChild className="flex-1">
                                <Link
                                  href={`/classes/workspace?classId=${cls.id}`}
                                  className="flex items-center gap-2"
                                >
                                  <span className="truncate">
                                    {cls.code} — {cls.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {transcriptionCounts[cls.id] ?? 0}
                                  </span>
                                </Link>
                              </SidebarMenuSubButton>

                              {/* 3-dot menu */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
                                    aria-label={`Options for ${cls.code}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" sideOffset={4}>
                                  <DropdownMenuItem onClick={() => togglePin(cls.id)}>
                                    <PinOff className="mr-2 h-4 w-4" />
                                    Unpin
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => startRename(cls.id)}>
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600"
                                    onClick={() => {
                                      setDeleteId(cls.id);
                                      setDeleteOpen(true);
                                    }}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </SidebarMenuSubItem>
                        ))}
                        <Separator className="my-2" />
                      </>
                    )}

                    {/* All classes (unpinned) */}
                    <div className="px-2 pt-1 text-xs text-muted-foreground">All classes</div>
                    {unpinned.map((cls) => (
                      <SidebarMenuSubItem key={cls.id}>
                        <div className="flex items-center gap-1">
                          <SidebarMenuSubButton asChild className="flex-1">
                            <Link
                              href={`/classes/workspace?classId=${cls.id}`}
                              className="flex items-center gap-2"
                            >
                              <span className="truncate">
                                {cls.code} — {cls.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {transcriptionCounts[cls.id] ?? 0}
                              </span>
                            </Link>
                          </SidebarMenuSubButton>

                          {/* 3-dot menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                aria-label={`Options for ${cls.code}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={4}>
                              <DropdownMenuItem onClick={() => togglePin(cls.id)}>
                                <Pin className="mr-2 h-4 w-4" />
                                Pin to sidebar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => startRename(cls.id)}>
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => {
                                  setDeleteId(cls.id);
                                  setDeleteOpen(true);
                                }}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}
        </SidebarMenu>
      </SidebarGroup>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename class</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1">
              <Label htmlFor="r-code">Module code</Label>
              <Input id="r-code" value={renameCode} onChange={(e) => setRenameCode(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="r-name">Class name</Label>
              <Input id="r-name" value={renameName} onChange={(e) => setRenameName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handleRenameSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this class?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the class from your sidebar. You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
