"use client";

import * as React from "react";
import { Brain, Save, RefreshCw, Upload, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useClasses } from "@/lib/classes/provider";
import { cn } from "@/lib/utils";

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
  const [loading, setLoading] = React.useState(true);
  const [globalUploadStatus, setGlobalUploadStatus] = React.useState<string | null>(null);
  const [classUploadStatus, setClassUploadStatus] = React.useState<Record<string, string | null>>({});
  const modelContextBridge =
    typeof window !== "undefined"
      ? (window as unknown as { modelContext?: { get?: () => Promise<{ success: boolean; settings?: ModelContextSettings; error?: string }>; save?: (settings: ModelContextSettings) => Promise<{ success: boolean; error?: string }> } }).modelContext
      : undefined;

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (typeof window === "undefined") return;
      try {
        if (modelContextBridge?.get) {
          const response = await modelContextBridge.get();
          if (!cancelled && response?.success && response.settings) {
            setSettings((prev) => ({ ...prev, ...response.settings }));
            setLoading(false);
            setGlobalUploadStatus(null);
            setClassUploadStatus({});
            return;
          }
        }
      } catch (error) {
        console.warn("Failed to load model context from bridge", error);
      }

      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ModelContextSettings;
          if (!cancelled) setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch (error) {
        console.warn("Failed to load model context settings", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
      if (!cancelled) {
        setGlobalUploadStatus(null);
        setClassUploadStatus({});
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [modelContextBridge]);

  const persist = React.useCallback(
    async (next: ModelContextSettings) => {
      if (modelContextBridge?.save) {
        const response = await modelContextBridge.save(next);
        if (!response?.success) {
          throw new Error(response?.error ?? "Failed to save model context");
        }
      } else if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (error) {
          console.warn("Failed to save model context settings", error);
        }
      }
    },
    [modelContextBridge]
  );

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    try {
      await persist(settings);
    } catch (error) {
      console.error("Failed to persist model context", error);
    } finally {
      setSaving(false);
    }
  }, [persist, settings]);

  const handleReset = React.useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      await persist(DEFAULT_SETTINGS);
    } catch (error) {
      console.error("Failed to reset model context", error);
    }
    setGlobalUploadStatus(null);
    setClassUploadStatus({});
  }, [persist]);

  const GLOBAL_CONTEXT_ID = "__global__";

  const handleGlobalFileProcessed = React.useCallback(
    async (info: ProcessedFileInfo) => {
      if (!info?.normalized.trim()) return;
      if (typeof window === "undefined") return;
      const api = (window as unknown as { api?: { invoke?: (channel: string, payload?: unknown) => Promise<unknown> } }).api;
      if (!api?.invoke) return;

      try {
        setGlobalUploadStatus(`Indexing ${info.file.name} for quick answers…`);

        const response = (await api.invoke("class-context:ingest", {
          classId: GLOBAL_CONTEXT_ID,
          fileName: info.file.name,
          text: info.normalized,
        })) as { success?: boolean; duplicate?: boolean; segments?: number; error?: string };

        if (response?.success) {
          const previewRaw = info.snippet.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 2).join(" ");
          const preview = previewRaw.length > 280 ? `${previewRaw.slice(0, 280)}…` : previewRaw;
          const suffix = response.duplicate
            ? " (already indexed globally)"
            : response.segments
            ? ` (${response.segments} snippets indexed globally)`
            : "";
          setGlobalUploadStatus(
            `Ready: ${info.file.name}${suffix}.${preview ? ` Preview: ${preview}` : ""}`
          );
        } else {
          setGlobalUploadStatus(`Failed to index ${info.file.name}: ${response?.error ?? "Unknown error"}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setGlobalUploadStatus(`Failed to index ${info.file.name}: ${message}`);
      }
    },
    []
  );

  const handleClassFileProcessed = React.useCallback(
    async (classId: string, info: ProcessedFileInfo) => {
      if (!classId || !info?.normalized.trim()) return;
      if (typeof window === "undefined") return;
      const api = (window as unknown as { api?: { invoke?: (channel: string, payload?: unknown) => Promise<unknown> } }).api;
      if (!api?.invoke) return;

      try {
        setClassUploadStatus((prev) => ({
          ...prev,
          [classId]: `Indexing ${info.file.name} for quick answers…`,
        }));

        const response = (await api.invoke("class-context:ingest", {
          classId,
          fileName: info.file.name,
          text: info.normalized,
        })) as { success?: boolean; duplicate?: boolean; segments?: number; error?: string };

        if (response?.success) {
          const previewRaw = info.snippet.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 2).join(" ");
          const preview = previewRaw.length > 280 ? `${previewRaw.slice(0, 280)}…` : previewRaw;
          const suffix = response.duplicate
            ? " (already indexed)"
            : response.segments
            ? ` (${response.segments} snippets indexed)`
            : "";
          setClassUploadStatus((prev) => ({
            ...prev,
            [classId]: `Ready: ${info.file.name}${suffix}.${preview ? ` Preview: ${preview}` : ""}`,
          }));
        } else {
          setClassUploadStatus((prev) => ({
            ...prev,
            [classId]: `Failed to index ${info.file.name}: ${response?.error ?? "Unknown error"}`,
          }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setClassUploadStatus((prev) => ({
          ...prev,
          [classId]: `Failed to index ${info.file.name}: ${message}`,
        }));
      }
    },
    []
  );

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

            <UploadDropZone
              label="Drop reference files or click to upload"
              status={globalUploadStatus}
              disabled={loading}
              onStatusChange={setGlobalUploadStatus}
              onFileProcessed={handleGlobalFileProcessed}
            />

            <Separator />

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving || loading}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : loading ? "Loading…" : "Save model context"}
              </Button>
              <Button type="button" variant="ghost" onClick={handleReset} disabled={saving || loading}>
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
                const status = classUploadStatus[cls.id] ?? null;
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
                        <UploadDropZone
                          label="Attach lecture references"
                          disabled={loading}
                          status={status}
                          onStatusChange={(message) =>
                            setClassUploadStatus((prev) => ({ ...prev, [cls.id]: message }))
                          }
                          onFileProcessed={(info) => handleClassFileProcessed(cls.id, info)}
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

type UploadDropZoneProps = {
  label: string;
  status: string | null;
  onStatusChange: (message: string | null) => void;
  onAppend?: (snippet: string) => void;
  disabled?: boolean;
  onFileProcessed?: (info: ProcessedFileInfo) => Promise<void> | void;
};

type ProcessedFileInfo = {
  file: File;
  normalized: string;
  summarised: boolean;
  snippet: string;
};

function UploadDropZone({ label, status, onAppend, onStatusChange, disabled, onFileProcessed }: UploadDropZoneProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const processFiles = React.useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList instanceof FileList ? Array.from(fileList) : fileList);
      if (!files.length || disabled) return;
      setBusy(true);
      for (const file of files) {
        if (disabled) break;
        try {
          onStatusChange(`Processing ${file.name}…`);
          const { snippet, summarised, normalized } = await buildSnippetFromFile(file);
          if (onAppend) {
            onAppend(snippet);
          }
          if (onFileProcessed) {
            await onFileProcessed({ file, normalized, summarised, snippet });
          }
          const preview = snippet.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 2).join(" ");
          onStatusChange(
            `Indexed ${file.name}${summarised ? " (summary generated)" : ""}.${preview ? ` Preview: ${preview}` : ""}`
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          onStatusChange(`Failed to import ${file.name}: ${message}`);
        }
      }
      setBusy(false);
    },
    [disabled, onAppend, onStatusChange, onFileProcessed]
  );

  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) return;
      void processFiles(event.target.files);
      event.target.value = "";
    },
    [processFiles]
  );

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);
      if (disabled) return;
      if (event.dataTransfer?.files?.length) {
        void processFiles(event.dataTransfer.files);
      }
    },
    [disabled, processFiles]
  );

  const handleDrag = React.useCallback((event: React.DragEvent<HTMLDivElement>, active: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) setDragActive(active);
  }, [disabled]);

  return (
    <div className="space-y-2">
      <div
        onDragOver={(event) => handleDrag(event, true)}
        onDragLeave={(event) => handleDrag(event, false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center transition",
          dragActive ? "border-primary bg-primary/10" : "",
          disabled ? "opacity-60" : "hover:border-primary/70"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".txt,.md,.markdown,.text,.csv,.json,.pdf"
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled || busy}
        />
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Upload className="h-4 w-4" />
          <span>{label}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {disabled ? "Upload unavailable while loading" : "Supports .txt, .md, .json, .csv, and .pdf files (first 20 pages)."}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          <FileText className="mr-2 h-4 w-4" />
          Choose files
        </Button>
      </div>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}

type SnippetResult = { snippet: string; summarised: boolean; normalized: string };

async function buildSnippetFromFile(file: File): Promise<SnippetResult> {
  const rawText = await extractTextFromFile(file);
  const normalized = normalizeWhitespace(rawText).trim();
  if (!normalized) {
    throw new Error('No readable text was found in this file.');
  }

  const MAX_EXCERPT = 4000;
  const AI_INPUT_LIMIT = 24000;
  let summarised = false;
  let body = normalized;

  if (normalized.length > MAX_EXCERPT) {
    const summary = await summariseWithAI(normalized.slice(0, AI_INPUT_LIMIT), file.name);
    if (summary) {
      summarised = true;
      const excerpt = normalized.slice(0, MAX_EXCERPT);
      body = `Summary:\n${summary.trim()}\n\nReference excerpt:\n${excerpt}${normalized.length > MAX_EXCERPT ? "…" : ""}`;
    } else {
      body = `${normalized.slice(0, MAX_EXCERPT)}${normalized.length > MAX_EXCERPT ? "…" : ""}`;
    }
  }

  const snippet = `Source: ${file.name}\n${body}`.trim();
  return { snippet, summarised, normalized };
}

async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (file.type.startsWith('text/') || ['txt', 'md', 'markdown', 'text', 'csv', 'json'].includes(extension)) {
    return await file.text();
  }
  if (extension === 'pdf' || file.type === 'application/pdf') {
    return await extractTextFromPdf(file);
  }
  throw new Error('Unsupported file type. Please upload a .txt, .md, .json, .csv, or .pdf file.');
}

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/webpack');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
  const MAX_PAGES = 20;
  const MAX_IMAGE_DESCRIPTIONS = 6;
  let text = '';
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);
  let imageDescriptionsCollected = 0;
  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const strings = (content.items as Array<{ str?: string }>)
      .map((item) => (typeof item.str === 'string' ? item.str : ''))
      .filter(Boolean);
    text += strings.join(' ') + '\n';

    if (imageDescriptionsCollected < MAX_IMAGE_DESCRIPTIONS) {
      try {
        const description = await describePdfPageVisuals(page, pageIndex, file.name);
        if (description) {
          imageDescriptionsCollected += 1;
          text += `\n[Visual Summary • Page ${pageIndex}]\n${description}\n`;
        }
      } catch (error) {
        console.warn('[PDF] Visual description failed', error);
      }
    }
  }
  if (pdf.numPages > MAX_PAGES) {
    text += '\n…';
  }
  return text;
}

async function describePdfPageVisuals(page: unknown, pageNumber: number, fileName: string): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const pdfPage = page as {
    getViewport: (opts: { scale: number }) => { width: number; height: number };
    render: (input: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => {
      promise: Promise<void>;
    };
  };
  const viewport = pdfPage.getViewport({ scale: 1.1 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  try {
    await pdfPage.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    if (!dataUrl || dataUrl.length < 100) return null;

    const api = (window as unknown as { api?: { invoke?: (channel: string, payload?: unknown) => Promise<unknown> } }).api;
    if (!api?.invoke) return null;

    const prompt = `You are describing visual content from the document "${fileName}" (page ${pageNumber}). ` +
      `Summarise diagrams, text, and imagery in 2-3 concise bullet points followed by a short paragraph that captures the main idea. ` +
      `If the slide is text-heavy, capture headings and key points. If it is mostly visual, describe the scene and any labels.`;

    try {
      const docResponse = (await api.invoke('ai:doc-analyse', {
        type: 'vision',
        dataUrl,
        prompt,
        instructions:
          'Describe the scene, diagrams, and any readable text from the provided slide. Output 2-3 bullet points followed by a short paragraph.',
      })) as { success?: boolean; content?: unknown; busy?: boolean; error?: string };

      if (docResponse?.success && typeof docResponse.content === 'string') {
        return docResponse.content.trim();
      }

      const response = (await api.invoke('ai:query', {
        query: `${prompt}\n\nImage (data URL): ${dataUrl}`,
      })) as { answer?: unknown; summary?: unknown };
      const candidate =
        typeof response?.answer === 'string'
          ? response.answer
          : typeof response?.summary === 'string'
          ? response.summary
          : null;
      return candidate ? candidate.trim() : null;
    } catch (error) {
      console.warn('[AI] Failed to describe PDF visuals:', error);
      return null;
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function summariseWithAI(text: string, fileName: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const api = (window as unknown as { api?: { invoke?: (channel: string, payload?: unknown) => Promise<unknown> } }).api;
  if (!api?.invoke) return null;
  try {
    const docResponse = (await api.invoke('ai:doc-analyse', {
      type: 'summary',
      text,
      fileName,
      instructions:
        'Extract the main ideas, definitions, and references from the uploaded lecture material. Return concise bullet points (max 8) suitable for guiding transcription summaries.',
    })) as { success?: boolean; content?: unknown; error?: string; busy?: boolean };

    if (docResponse?.success && typeof docResponse.content === 'string') {
      return docResponse.content.trim();
    }

    const response = (await api.invoke('ai:query', {
      query: `You are preparing lecture transcription context. Summarise the key ideas, definitions, and references from the document titled "${fileName}". Provide concise bullet points (max 8) that should guide lecture summaries.\n\n${text}`,
    })) as { answer?: unknown; summary?: unknown };
    const answer = typeof response?.answer === 'string' ? response.answer : null;
    const summary = typeof response?.summary === 'string' ? response.summary : null;
    const candidate = answer ?? summary;
    return typeof candidate === 'string' ? candidate.trim() : null;
  } catch (error) {
    console.warn('Failed to summarise document via AI', error);
    return null;
  }
}

function normalizeWhitespace(text: string) {
  return text.replace(/\r\n|\r/g, '\n').replace(/\n{3,}/g, '\n\n');
}
