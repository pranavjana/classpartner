"use client";
import { useEffect, useRef, useState } from "react";

export default function DemoPage() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [messages, setMessages] = useState<Array<{role:"user"|"assistant"; text:string}>>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      setRecording(true);
      tick();
      // seed “chat”
      setMessages([
        { role: "user", text: "What does the lecturer mean by gradient descent?" },
        { role: "assistant", text: "It’s an optimization method that iteratively updates parameters in the direction of the negative gradient to minimize a loss." },
      ]);
    } catch (e: any) {
      setError(e?.message || "Microphone permission denied");
    }
  }

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setRecording(false);
    setLevel(0);
  }

  function tick() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    // simple RMS-ish level meter
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    setLevel(rms);
    rafRef.current = requestAnimationFrame(tick);
  }

  function ask(question: string) {
    setMessages(m => [...m, { role: "user", text: question }]);
    // fake an “AI answer” for demo purposes
    setTimeout(() => {
      setMessages(m => [...m, { role: "assistant", text: "Here’s a quick explanation grounded in the last minute of audio… (demo)" }]);
    }, 600);
  }

  useEffect(() => () => stop(), []);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold">Live Demo</h1>
        <p className="mt-2 text-gray-300">
          This demo listens via your microphone and simulates the real-time Q&amp;A experience.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {/* Left: mic & controls */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Microphone</span>
              <span className={`text-xs ${recording ? "text-emerald-400" : "text-gray-500"}`}>
                {recording ? "Recording" : "Idle"}
              </span>
            </div>
            <div className="mt-4 h-28 rounded-xl bg-gray-950 border border-gray-800 p-3">
              {/* simple level meter */}
              <div className="h-full w-full rounded-lg bg-gray-900 relative overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 bg-indigo-500 transition-[height] duration-150"
                  style={{ height: `${Math.min(100, Math.max(5, level * 160))}%` }}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              {!recording ? (
                <button onClick={start} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500">
                  Start recording
                </button>
              ) : (
                <button onClick={stop} className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-800">
                  Stop
                </button>
              )}
              <button
                onClick={() => ask("Summarise the last minute")}
                className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-800"
              >
                Ask: Summarise last minute
              </button>
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <p className="mt-4 text-xs text-gray-500">
              Tip: Play any lecture/video out loud near your laptop mic to simulate a class.
            </p>
          </div>

          {/* Right: chat panel */}
          <div className="md:col-span-2 rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-lg font-semibold">Q&amp;A</h2>
            <div className="mt-4 h-80 overflow-auto rounded-xl border border-gray-800 bg-gray-950 p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`max-w-[85%] rounded-xl px-4 py-2 text-sm ${m.role === "user" ? "ml-auto bg-indigo-600 text-white" : "bg-gray-800 text-gray-100"}`}>
                  {m.text}
                </div>
              ))}
              {!messages.length && (
                <div className="text-sm text-gray-400">Ask a question to get started…</div>
              )}
            </div>
            <DemoInput onSend={ask} disabled={!recording} />
          </div>
        </div>
      </div>
    </main>
  );
}

function DemoInput({ onSend, disabled }: { onSend: (q: string) => void; disabled?: boolean }) {
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        onSend(q.trim());
        setQ("");
      }}
      className="mt-4 flex gap-2"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={disabled ? "Start recording to ask…" : "Ask anything"}
        className="flex-1 rounded-xl border border-gray-800 bg-gray-950 px-4 py-2 text-sm outline-none focus:border-indigo-600"
        disabled={disabled}
      />
      <button disabled={disabled} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        Send
      </button>
    </form>
  );
}
