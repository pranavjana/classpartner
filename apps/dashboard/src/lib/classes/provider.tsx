"use client";

import * as React from "react";

export type ClassItem = {
  id: string;
  code: string;
  name: string;
  slug: string;
  /** optional count shown in UI; defaults to 0 when missing */
  transcriptions?: number;
};

type ClassesContextValue = {
  ready: boolean;
  classes: ClassItem[];
  pinnedIds: string[];
  addClass: (item: ClassItem) => void;
  renameClass: (id: string, patch: Pick<ClassItem, "code" | "name">) => void;
  deleteClass: (id: string) => void;
  togglePin: (id: string) => void;
  setClasses: React.Dispatch<React.SetStateAction<ClassItem[]>>;
  setPinnedIds: React.Dispatch<React.SetStateAction<string[]>>;
};

const LS_CLASSES = "cp_classes";
const LS_PINNED = "cp_pinned";

const ClassesContext = React.createContext<ClassesContextValue | undefined>(undefined);

type ClassesProviderProps = React.PropsWithChildren<{
  seed?: ClassItem[];
}>;

export function ClassesProvider({ children, seed = [] }: ClassesProviderProps) {
  const [ready, setReady] = React.useState(false);
  const [classes, setClasses] = React.useState<ClassItem[]>(seed);
  const [pinnedIds, setPinnedIds] = React.useState<string[]>([]);

  // Hydrate from localStorage on client only
  React.useEffect(() => {
    try {
      const c = localStorage.getItem(LS_CLASSES);
      const p = localStorage.getItem(LS_PINNED);
      if (c) setClasses(JSON.parse(c));
      if (p) setPinnedIds(JSON.parse(p));
    } catch {}
    setReady(true);
  }, []);

  // Persist whenever things change (after hydration)
  React.useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(LS_CLASSES, JSON.stringify(classes));
      localStorage.setItem(LS_PINNED, JSON.stringify(pinnedIds));
    } catch {}
  }, [classes, pinnedIds, ready]);

  const addClass = (item: ClassItem) => setClasses((prev) => [...prev, item]);

  const renameClass = (id: string, patch: Pick<ClassItem, "code" | "name">) =>
    setClasses((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ...patch, slug: slugify(`${patch.code ?? c.code}-${patch.name ?? c.name}`) } : c
      )
    );

  const deleteClass = (id: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    setPinnedIds((prev) => prev.filter((pid) => pid !== id));
  };

  const togglePin = (id: string) =>
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const value: ClassesContextValue = {
    ready,
    classes,
    pinnedIds,
    addClass,
    renameClass,
    deleteClass,
    togglePin,
    setClasses,
    setPinnedIds,
  };

  return <ClassesContext.Provider value={value}>{children}</ClassesContext.Provider>;
}

export function useClasses() {
  const ctx = React.useContext(ClassesContext);
  if (!ctx) throw new Error("useClasses must be used within a ClassesProvider");
  return ctx;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
