"use client";

import * as React from "react";

export type ClassItem = {
  id: string;
  code: string;
  name: string;
  slug: string;
  /** optional count shown in UI; defaults to 0 when missing */
  transcriptions?: number;
  archived?: boolean;
};

type ClassesContextValue = {
  ready: boolean;
  classes: ClassItem[];
  archivedClasses: ClassItem[];
  pinnedIds: string[];
  addClass: (item: ClassItem) => void;
  renameClass: (id: string, patch: Pick<ClassItem, "code" | "name">) => void;
  deleteClass: (id: string) => Promise<{ success: boolean; error?: string }>;
  archiveClass: (id: string, archived?: boolean) => Promise<{ success: boolean; error?: string }>;
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
  const bridge = typeof window !== "undefined" ? window.transcriptStorage : undefined;
  const useBridge = Boolean(bridge);

  const [ready, setReady] = React.useState(false);
  const [allClasses, setAllClasses] = React.useState<ClassItem[]>([]);
  const [pinnedIds, setPinnedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      let storedPins: string[] = [];
      let storedClasses: ClassItem[] | null = null;

      if (typeof window !== "undefined") {
        try {
          const rawPins = localStorage.getItem(LS_PINNED);
          if (rawPins) storedPins = JSON.parse(rawPins);
        } catch {}

        try {
          const rawClasses = localStorage.getItem(LS_CLASSES);
          if (rawClasses) storedClasses = JSON.parse(rawClasses);
        } catch {}
      }

      if (useBridge && bridge) {
        try {
          if (storedClasses?.length) {
            await Promise.all(
              storedClasses.map((item) =>
                bridge.saveClass(classItemToBridgePayload(item)).catch((error) => {
                  console.error("[ClassesProvider] Failed to migrate class to SQLite", error);
                })
              )
            );
            localStorage.removeItem(LS_CLASSES);
          }

          const response = await bridge.listClasses();
          let items: ClassItem[] =
            response?.success && Array.isArray(response.classes)
              ? response.classes.map(mapBridgeClassRecord)
              : [];

          if (items.length === 0 && seed.length) {
            await Promise.all(
              seed.map((item) =>
                bridge.saveClass(classItemToBridgePayload(item)).catch((error) => {
                  console.error("[ClassesProvider] Failed to seed class into SQLite", error);
                })
              )
            );
            const seeded = await bridge.listClasses();
            if (seeded?.success && Array.isArray(seeded.classes)) {
              items = seeded.classes.map(mapBridgeClassRecord);
            }
          }

      if (!cancelled) {
        setAllClasses(items);
      }
        } catch (error) {
          console.error("[ClassesProvider] Failed to load classes from SQLite:", error);
          if (!cancelled) {
            setAllClasses(storedClasses ?? seed);
          }
        }
      } else {
        if (!cancelled) {
          setAllClasses(storedClasses ?? seed);
        }
      }

      if (!cancelled) {
        setPinnedIds(storedPins);
        setReady(true);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [bridge, seed, useBridge]);

  React.useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(LS_PINNED, JSON.stringify(pinnedIds));
      if (!useBridge) {
        localStorage.setItem(LS_CLASSES, JSON.stringify(allClasses));
      }
    } catch (error) {
      console.warn("[ClassesProvider] Failed to persist classes", error);
    }
  }, [allClasses, pinnedIds, ready, useBridge]);

  const activeClasses = React.useMemo(
    () => allClasses.filter((cls) => !cls.archived),
    [allClasses]
  );

  const archivedClasses = React.useMemo(
    () => allClasses.filter((cls) => cls.archived),
    [allClasses]
  );

const addClass = React.useCallback(
    (item: ClassItem) => {
      const nextItem: ClassItem = { ...item, archived: Boolean(item.archived) };
      setAllClasses((prev) => [...prev, nextItem]);
      if (useBridge && bridge) {
        bridge
          .saveClass(classItemToBridgePayload(nextItem))
          .then((res) => {
            if (res?.success && res.class) {
              const mapped = mapBridgeClassRecord(res.class);
              setAllClasses((prev) => prev.map((cls) => (cls.id === mapped.id ? mapped : cls)));
            }
          })
          .catch((error) => console.error("[ClassesProvider] Failed to save class:", error));
      }
    },
    [bridge, useBridge]
  );

  const renameClass = React.useCallback(
    (id: string, patch: Pick<ClassItem, "code" | "name">) => {
      let nextClass: ClassItem | null = null;
      setAllClasses((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const updated: ClassItem = {
            ...c,
            ...patch,
            slug: slugify(`${patch.code ?? c.code}-${patch.name ?? c.name}`),
          };
          nextClass = updated;
          return updated;
        })
      );

      if (useBridge && bridge && nextClass) {
        bridge
          .saveClass(classItemToBridgePayload(nextClass))
          .then((res) => {
            if (res?.success && res.class) {
              const mapped = mapBridgeClassRecord(res.class);
              setAllClasses((prev) => prev.map((cls) => (cls.id === mapped.id ? mapped : cls)));
            }
          })
          .catch((error) => console.error("[ClassesProvider] Failed to rename class:", error));
      }
    },
    [bridge, useBridge]
  );

  const deleteClass = React.useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      if (useBridge && bridge) {
        try {
          const response = await bridge.deleteClass(id);
          if (!response?.success) {
            const message = response?.error ?? "Failed to delete class";
            return { success: false, error: message };
          }
        } catch (error) {
          console.error("[ClassesProvider] Failed to delete class:", error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      }

      setAllClasses((prev) => prev.filter((c) => c.id !== id));
      setPinnedIds((prev) => prev.filter((pid) => pid !== id));
      return { success: true };
    },
    [bridge, useBridge]
  );

  const archiveClass = React.useCallback(
    async (id: string, archived: boolean = true): Promise<{ success: boolean; error?: string }> => {
      let mapped: ClassItem | null = null;
      if (useBridge && bridge?.archiveClass) {
        try {
          const response = await bridge.archiveClass(id, archived);
          if (!response?.success) {
            const message = response?.error ?? "Failed to update class";
            return { success: false, error: message };
          }
          if (response.class) {
            mapped = mapBridgeClassRecord(response.class as Record<string, unknown>);
          }
        } catch (error) {
          console.error("[ClassesProvider] Failed to archive class:", error);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      }

      setAllClasses((prev) => {
        const next = prev.map((cls) =>
          cls.id === id ? mapped ?? { ...cls, archived } : cls
        );
        return next;
      });

      if (archived) {
        setPinnedIds((prev) => prev.filter((pid) => pid !== id));
      }

      return { success: true };
    },
    [bridge, useBridge]
  );

  const togglePin = React.useCallback(
    (id: string) =>
      setPinnedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    []
  );

  React.useEffect(() => {
    if (!ready) return;
    setPinnedIds((prev) => prev.filter((id) => activeClasses.some((cls) => cls.id === id)));
  }, [activeClasses, ready]);

  const value: ClassesContextValue = {
    ready,
    classes: activeClasses,
    archivedClasses,
    pinnedIds,
    addClass,
    renameClass,
    deleteClass,
    archiveClass,
    togglePin,
    setClasses: setAllClasses,
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

function classItemToBridgePayload(item: ClassItem) {
  const metadata: Record<string, unknown> = {
    slug: item.slug,
    archived: item.archived ?? false,
  };

  if (typeof item.transcriptions === "number") {
    metadata.transcriptions = item.transcriptions;
  }

  return {
    id: item.id,
    code: item.code || undefined,
    name: item.name,
    metadata,
    createdAt: Date.now(),
  };
}

function mapBridgeClassRecord(raw: Record<string, unknown>): ClassItem {
  const name = typeof raw.name === "string" ? raw.name : "Untitled class";
  const id = typeof raw.id === "string" ? raw.id : String(raw.id ?? slugify(name));
  const code = typeof raw.code === "string" ? raw.code : "";
  const metadata =
    raw.metadata && typeof raw.metadata === "object" && raw.metadata !== null ? (raw.metadata as Record<string, unknown>) : {};
  const slugFromMeta = typeof metadata.slug === "string" ? metadata.slug : undefined;
  const slug = slugFromMeta ?? slugify(`${code || name}-${id}`);
  const transcriptions =
    typeof metadata.transcriptions === "number" ? metadata.transcriptions : undefined;
  const archived = typeof metadata.archived === "boolean" ? metadata.archived : Boolean(metadata.archived);

  return {
    id,
    code,
    name,
    slug,
    transcriptions,
    archived,
  };
}
