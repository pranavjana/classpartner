"use client";

import * as React from "react";
import { Brain, Save, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useClasses } from "@/lib/classes/provider";

type ModelContextSettings = {
  globalGuidelines: string;
  includeActionItems: boolean;
  emphasiseKeyTerms: boolean;
  classContexts: Record<string, string>;
};

const STORAGE_KEY = "cp_model_context_v1";

const DEFAULT_SETTINGS: ModelContextSettings = {
  globalGuidelines:
    "Summarise the lecture in clear sections: recap previous material, key concepts, demonstrations, and next steps. Highlight equations or definitions explicitly and list action items.",
  includeActionItems: true,
  emphasiseKeyTerms: true,
  classContexts: {},
};

export default function ModelContextPage() {
  const { classes } = useClasses();
  const [settings, setSettings] = React.useState<ModelContextSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ModelContextSettings;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.warn("Failed to load model context settings", error);
    }
  }, []);

  const persist = React.useCallback(
    (next: ModelContextSettings) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.warn("Failed to save model context settings", error);
      }
    },
    []
  );

  const handleSave = () => {
    setSaving(true);
    try {
      persist(settings);
    } finally {
      setTimeout(() => setSaving(false), 400);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    persist(DEFAULT_SETTINGS);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Model context</h1>
        <p className="text-sm text-muted-foreground">
          Tailor how the AI assistant summarises and analyses transcripts before notes are saved to your classes.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="border-border">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Brain className="h-5 w-5 text-primary" />
              Global guidelines
            </CardTitle>
            <CardDescription>
              Provide high-level instructions that every transcript should follow. These apply across all classes unless
              overridden below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="global-guidelines">Prompt</Label>
              <Textarea
                id="global-guidelines"
                value={settings.globalGuidelines}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, globalGuidelines: event.target.value }))
                }
                rows={8}
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <ToggleSetting
                id="action-items"
                title="Include action items"
                description="Generate a bullet list of tasks, deadlines, or follow-up questions."
                checked={settings.includeActionItems}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, includeActionItems: checked }))
                }
              />
              <ToggleSetting
                id="emphasise-terms"
                title="Emphasise key terms"
                description="Highlight terminology, formulas, and references explicitly."
                checked={settings.emphasiseKeyTerms}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, emphasiseKeyTerms: checked }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : "Save model context"}
              </Button>
              <Button type="button" variant="ghost" onClick={handleReset}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset to defaults
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl">Class-specific overrides</CardTitle>
            <CardDescription>
              Add context for modules that need specialised summaries, e.g. lab steps, performance notes, or references.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You have not added any classes yet. Create one from the sidebar to customise its AI behaviour.
              </p>
            ) : (
              classes.map((cls) => {
                const value = settings.classContexts[cls.id] ?? "";
                return (
                  <Collapsible key={cls.id} className="rounded-xl border border-border">
                    <CollapsibleTrigger className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
                      {cls.code} — {cls.name}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 border-t border-border bg-muted/20 p-4">
                        <Label htmlFor={`ctx-${cls.id}`} className="text-xs text-muted-foreground uppercase">
                          Custom instructions
                        </Label>
                        <Textarea
                          id={`ctx-${cls.id}`}
                          placeholder="Describe what to emphasise for this module."
                          value={value}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              classContexts: { ...prev.classContexts, [cls.id]: event.target.value },
                            }))
                          }
                          rows={6}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ToggleSetting({
  id,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-1 min-w-[220px] items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <div>
        <Label htmlFor={id} className="text-sm font-semibold">
          {title}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
