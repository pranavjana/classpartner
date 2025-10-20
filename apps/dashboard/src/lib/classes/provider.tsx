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
  const bridge = typeof window !== "undefined" ? window.transcriptStorage : undefined;
  const useBridge = Boolean(bridge);

  const [ready, setReady] = React.useState(false);
  const [classes, setClasses] = React.useState<ClassItem[]>([]);
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
            setClasses(items);
          }
        } catch (error) {
          console.error("[ClassesProvider] Failed to load classes from SQLite:", error);
          if (!cancelled) {
            setClasses(storedClasses ?? seed);
          }
        }
      } else {
        if (!cancelled) {
          setClasses(storedClasses ?? seed);
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
        localStorage.setItem(LS_CLASSES, JSON.stringify(classes));
      }
    } catch (error) {
      console.warn("[ClassesProvider] Failed to persist classes", error);
    }
  }, [classes, pinnedIds, ready, useBridge]);

  const addClass = React.useCallback(
    (item: ClassItem) => {
      setClasses((prev) => [...prev, item]);
      if (useBridge && bridge) {
        bridge
          .saveClass(classItemToBridgePayload(item))
          .then((res) => {
            if (res?.success && res.class) {
              const mapped = mapBridgeClassRecord(res.class);
              setClasses((prev) => prev.map((cls) => (cls.id === mapped.id ? mapped : cls)));
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
      setClasses((prev) =>
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
              setClasses((prev) => prev.map((cls) => (cls.id === mapped.id ? mapped : cls)));
            }
          })
          .catch((error) => console.error("[ClassesProvider] Failed to rename class:", error));
      }
    },
    [bridge, useBridge]
  );

  const deleteClass = React.useCallback(
    (id: string) => {
      setClasses((prev) => prev.filter((c) => c.id !== id));
      setPinnedIds((prev) => prev.filter((pid) => pid !== id));
      if (useBridge && bridge) {
        bridge.deleteClass(id).catch((error) => console.error("[ClassesProvider] Failed to delete class:", error));
      }
    },
    [bridge, useBridge]
  );

  const togglePin = React.useCallback(
    (id: string) =>
      setPinnedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    []
  );

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

function classItemToBridgePayload(item: ClassItem) {
  return {
    id: item.id,
    code: item.code || undefined,
    name: item.name,
    metadata: { slug: item.slug },
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

  return {
    id,
    code,
    name,
    slug,
    transcriptions,
  };
}
