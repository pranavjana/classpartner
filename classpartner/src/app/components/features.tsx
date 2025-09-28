const features = [
  { title: "Live capture", desc: "Record lectures, meetings, or upload existing videos." },
  { title: "Ask anything", desc: "Chat beside the player—answers cite the exact moment." },
  { title: "Jump-to-explanation", desc: "Click a response to scrub the timeline to that answer." },
  { title: "Searchable transcript", desc: "Find topics and terms instantly, across the whole talk." },
  { title: "Smart notes", desc: "Auto summaries and key points; copy or export when you’re done." },
  { title: "Chapters", desc: "Auto chaptering creates a map of the session as it unfolds." },
];

export default function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-16">
      <h2 className="text-center text-2xl font-semibold">What makes it different</h2>
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-sm hover:shadow">
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-gray-300">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
