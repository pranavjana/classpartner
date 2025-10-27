"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { applyAccentColor, applyThemeSetting } from "@/lib/ui/theme";

/**
 * Public helper — call this from your sidebar's "General Settings" item:
 * onClick={() => openGeneralSettingsDialog()}
 */
export function openGeneralSettingsDialog() {
  window.dispatchEvent(new CustomEvent("open-general-settings-dialog"));
}

/** Shape of the settings this dialog edits. Adjust as needed. */
type GeneralSettings = {
  theme: "system" | "light" | "dark";
  language: "en" | "fr" | "de" | "es";
  launchOnStartup: boolean;
  minimizeToTray: boolean;
  confirmOnExit: boolean;
  alwaysOnTop: boolean;
  transparency: number; // 0..100
  analyticsOptIn: boolean;
  accentHex: string; // e.g. #3b82f6
};

const DEFAULT_SETTINGS: GeneralSettings = {
  theme: "system",
  language: "en",
  launchOnStartup: true,
  minimizeToTray: true,
  confirmOnExit: true,
  alwaysOnTop: false,
  transparency: 0,
  analyticsOptIn: false,
  accentHex: "#3b82f6",
};

const STORAGE_KEY = "app.generalSettings.v1";
const HEX_COLOR_REGEX = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

function loadSettings(): GeneralSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: GeneralSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/**
 * GeneralSettingsDialog
 * - Renders a modal settings window using shadcn/ui Dialog
 * - Opens when you call openGeneralSettingsDialog()
 * - Persists to localStorage by default; stubbed hooks where you can call Electron APIs
 */
export default function GeneralSettingsDialog() {
  const initialSettings = React.useMemo<GeneralSettings>(() => loadSettings(), []);
  const [open, setOpen] = React.useState(false);
  const [settings, setSettings] = React.useState<GeneralSettings>(initialSettings);
  const [baseline, setBaseline] = React.useState<GeneralSettings>(initialSettings);
  const [dirty, setDirty] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const electronApi = React.useMemo(
    () =>
      typeof window !== "undefined"
        ? (window as unknown as {
            electronAPI?: {
              getSettings?: () => Promise<{ generalSettings?: Partial<GeneralSettings> }>;
              updateSettings?: (settings: unknown) => Promise<unknown>;
            };
          }).electronAPI
        : undefined,
    []
  );
  const accentHexValue = (settings.accentHex ?? "").trim();
  const isAccentHexValid = HEX_COLOR_REGEX.test(accentHexValue);

  const hydrateFromSources = React.useCallback(async (): Promise<GeneralSettings> => {
    const freshestLocal = loadSettings();
    let merged: GeneralSettings = { ...DEFAULT_SETTINGS, ...initialSettings, ...freshestLocal };
    if (electronApi?.getSettings) {
      try {
        const snapshot = await electronApi.getSettings();
        const general = snapshot?.generalSettings;
        if (general && typeof general === "object") {
          merged = { ...merged, ...general };
        }
      } catch (error) {
        console.warn("Failed to load general settings from desktop bridge", error);
      }
    }
    return merged;
  }, [electronApi, initialSettings]);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const merged = await hydrateFromSources();
        if (!mounted) return;
        setSettings(merged);
        setBaseline({ ...merged });
        setDirty(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [hydrateFromSources]);

  React.useEffect(() => {
    if (!isAccentHexValid) return;
    applyAccentColor(accentHexValue);
  }, [accentHexValue, isAccentHexValid]);

  React.useEffect(() => {
    applyThemeSetting(settings.theme);
    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemeSetting("system");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [settings.theme]);

  // Open on custom event
  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-general-settings-dialog", onOpen);
    return () => window.removeEventListener("open-general-settings-dialog", onOpen);
  }, []);

  // Helpers
  const update = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      setDirty(JSON.stringify(next) !== JSON.stringify(baseline));
      return next;
    });
  };

  const handleSave = async () => {
    if (!isAccentHexValid) {
      console.warn("Blocked save because accent color is invalid.");
      return;
    }

    const next = { ...settings, accentHex: accentHexValue };

    if (electronApi?.updateSettings) {
      try {
        await electronApi.updateSettings({ generalSettings: next });
      } catch (error) {
        console.error("Failed to sync general settings with desktop bridge", error);
        // Continue with local persistence so preferences are not lost
      }
    }

    try {
      saveSettings(next);
    } catch (error) {
      console.error("Failed to persist general settings locally", error);
      return;
    }

    setSettings(next);
    setBaseline(next);
    setDirty(false);
    setOpen(false);
  };

  const handleCancel = () => {
    setSettings({ ...baseline });
    setDirty(false);
    setOpen(false);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    setDirty(JSON.stringify(DEFAULT_SETTINGS) !== JSON.stringify(baseline));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0" aria-busy={loading}>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>General Settings</DialogTitle>
          <DialogDescription>Configure appearance, behaviour, and privacy.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <>
            <Separator className="my-4" />
            <SettingsSkeleton />
          </>
        ) : (
          <>
            <Separator className="my-4" />

            {/* Appearance */}
            <section className="px-6 py-2 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Appearance</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={settings.theme}
                    onValueChange={(v: "system" | "light" | "dark") => update("theme", v)}
                  >
                    <SelectTrigger id="theme" className="w-full">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Theme</SelectLabel>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Use your OS preference or force light/dark.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accent">Accent colour (HEX)</Label>
                  <Input
                    id="accent"
                    value={settings.accentHex}
                    onChange={(e) => update("accentHex", e.target.value)}
                    placeholder="#3b82f6"
                    pattern="^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$"
                    title="Enter a valid 3- or 6-digit hex colour (e.g., #3b82f6)"
                  />
                  {isAccentHexValid ? (
                    <p className="text-xs text-muted-foreground">Used for buttons/highlights.</p>
                  ) : (
                    <p className="text-xs text-destructive">Enter a valid hex colour such as #3b82f6.</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Window transparency</Label>
                      <p className="text-xs text-muted-foreground">
                        0% is opaque, 100% is fully transparent.
                      </p>
                    </div>
                    <div className="text-sm tabular-nums">{settings.transparency}%</div>
                  </div>
                  <Slider
                    value={[settings.transparency]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(v) => update("transparency", v[0] ?? 0)}
                  />
                </div>
              </div>
            </section>

            <Separator className="my-4" />

            {/* Behaviour */}
            <section className="px-6 py-2 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Behaviour</h3>

              <div className="grid gap-4">
                <ToggleRow
                  label="Launch on startup"
                  description="Start the app when you sign in."
                  checked={settings.launchOnStartup}
                  onCheckedChange={(v) => update("launchOnStartup", v)}
                />
                <ToggleRow
                  label="Minimise to tray"
                  description="Keep the app running in the background when closed."
                  checked={settings.minimizeToTray}
                  onCheckedChange={(v) => update("minimizeToTray", v)}
                />
                <ToggleRow
                  label="Confirm on exit"
                  description="Ask before quitting the application."
                  checked={settings.confirmOnExit}
                  onCheckedChange={(v) => update("confirmOnExit", v)}
                />
                <ToggleRow
                  label="Always on top"
                  description="Keep the window above others."
                  checked={settings.alwaysOnTop}
                  onCheckedChange={(v) => update("alwaysOnTop", v)}
                />
              </div>
            </section>

            <Separator className="my-4" />

            {/* Language & Privacy */}
            <section className="px-6 pt-2 pb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={settings.language}
                    onValueChange={(v: "en" | "fr" | "de" | "es") => update("language", v)}
                  >
                    <SelectTrigger id="language" className="w-full">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Language</SelectLabel>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Applies after restart in some views.</p>
                </div>

                <div className="space-y-2">
                  <Label>Usage analytics</Label>
                  <ToggleInline
                    checked={settings.analyticsOptIn}
                    onCheckedChange={(v) => update("analyticsOptIn", v)}
                    labelOn="Enabled"
                    labelOff="Disabled"
                  />
                  <p className="text-xs text-muted-foreground">
                    Helps improve the app. No transcripts or personal content are collected.
                  </p>
                </div>
              </div>

              <div className={cn("mt-6 flex items-center justify-between gap-3")}>
                <Button variant="ghost" onClick={handleReset} disabled={loading}>
                  Reset to defaults
                </Button>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={!dirty || loading || !isAccentHexValid}>
                    {loading ? "Loading..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6 px-6 pb-6" aria-hidden="true">
      {[0, 1, 2].map((section) => (
        <div key={section} className="space-y-3 rounded-xl border border-border/60 p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-5/6" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ))}
      <div className="flex items-center justify-end gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

/** Small helper row for labelled switches */
function ToggleRow(props: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor={id}>{props.label}</Label>
        {props.description ? (
          <p className="text-xs text-muted-foreground">{props.description}</p>
        ) : null}
      </div>
      <Switch id={id} checked={props.checked} onCheckedChange={props.onCheckedChange} />
    </div>
  );
}

/** Inline switch with tiny label text */
function ToggleInline(props: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  labelOn?: string;
  labelOff?: string;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={props.checked} onCheckedChange={props.onCheckedChange} />
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {props.checked ? props.labelOn ?? "On" : props.labelOff ?? "Off"}
      </Label>
    </div>
  );
}
