const faqs = [
  { q: "What can I record?", a: "Live lectures, tutorials, meetings, screen shares—or upload existing videos." },
  { q: "How are answers generated?", a: "They’re grounded in the transcript and point you to the exact timestamp." },
  { q: "Is my media private?", a: "Yes. Content stays in your account unless you choose to share it." },
  { q: "Does it work with long videos?", a: "Yes. You can search, chapter and jump across hours of content." },
];

export default function FAQ() {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-20">
      <h2 className="text-center text-2xl font-semibold">Questions</h2>
      <div className="mt-8 space-y-6">
        {faqs.map((f) => (
          <details key={f.q} className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <summary className="cursor-pointer text-base font-semibold">{f.q}</summary>
            <p className="mt-3 text-sm text-gray-300">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
