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
import { cn } from "@/lib/utils"; // optional: remove if you don't use cn()
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

function loadSettings(): GeneralSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: GeneralSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/**
 * GeneralSettingsDialog
 * - Renders a modal settings window using shadcn/ui Dialog
 * - Opens when you call openGeneralSettingsDialog()
 * - Persists to localStorage by default; stubbed hooks where you can call Electron APIs
 */
export default function GeneralSettingsDialog() {
  const [open, setOpen] = React.useState(false);
  const [settings, setSettings] = React.useState<GeneralSettings>(DEFAULT_SETTINGS);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    applyAccentColor(settings.accentHex);
  }, [settings.accentHex]);

  React.useEffect(() => {
    applyThemeSetting(settings.theme);
    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemeSetting("system");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [settings.theme]);

  // Load on mount
  React.useEffect(() => {
    setSettings(loadSettings());
  }, []);

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
      setDirty(true);
      return next;
    });
  };

  const handleSave = async () => {
    // Persist local copy
    saveSettings(settings);

    // —— Optional integration points (uncomment/adjust as needed) ——
    // Electron: launch on startup
    // window.api?.invoke("settings:setLaunchOnStartup", { enabled: settings.launchOnStartup });
    // Always on top toggle (example):
    // if (typeof window !== "undefined" && "electronAPI" in window) {
    //   // @ts-expect-error
    //   await window.electronAPI?.toggleAlwaysOnTop?.(settings.alwaysOnTop);
    // }
    // Theme switch: set data-theme attribute or use your theme system here.
    // document.documentElement.dataset.theme = settings.theme;

    // Toast (if you have shadcn toast hooked up)
    try {
      // @ts-expect-error just because like that
      toast?.({ title: "Settings saved" });
    } catch {
      // no-op if toast not available
    }

    setDirty(false);
    setOpen(false);
  };

  const handleCancel = () => {
    // Revert to saved version
    setSettings(loadSettings());
    setDirty(false);
    setOpen(false);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setDirty(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>General Settings</DialogTitle>
          <DialogDescription>Configure appearance, behaviour, and privacy.</DialogDescription>
        </DialogHeader>

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
              />
              <p className="text-xs text-muted-foreground">Used for buttons/highlights.</p>
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
            <Button variant="ghost" onClick={handleReset}>
              Reset to defaults
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!dirty}>
                Save changes
              </Button>
            </div>
          </div>
        </section>
      </DialogContent>
    </Dialog>
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
