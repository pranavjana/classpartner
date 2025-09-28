const steps = [
  { n: "1", title: "Record or upload", desc: "Start a live capture or drop in a file/URL from your library." },
  { n: "2", title: "Ask while watching", desc: "Type any question—definitions, derivations, comparisons, examples." },
  { n: "3", title: "Jump and retain", desc: "Each answer links to a timestamp and adds to your notes automatically." },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-6">
      <h2 className="text-center text-2xl font-semibold">Three steps, zero friction</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 text-sm font-semibold">{s.n}</div>
            <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-gray-300">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
