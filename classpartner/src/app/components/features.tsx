"use client";
import Reveal from "./Reveal";
import { Mic, Sparkles, Search, FileText } from "lucide-react";

const features = [
  {
    title: "Live mic capture",
    desc: "Your laptop listens while you attend class, Zoom, or play a lecture out loud.",
    icon: Mic,
  },
  {
    title: "Ask anything",
    desc: "Chat beside the feed—answers are grounded in what was just said.",
    icon: Sparkles,
  },
  {
    title: "Searchable transcript",
    desc: "Every word captured. Find topics and jump to exact explanations.",
    icon: Search,
  },
  {
    title: "Smart notes",
    desc: "Auto highlights and summaries you can review after class.",
    icon: FileText,
  },
];

export default function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-16">
      <Reveal>
        <h2 className="text-center text-2xl font-semibold">What makes it different</h2>
      </Reveal>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={0.1 * i}>
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-sm transition hover:shadow-lg hover:border-indigo-600">
              <f.icon className="h-8 w-8 text-indigo-400" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-300">{f.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
