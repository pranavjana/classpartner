export default function ProblemSolution() {
  return (
    <section className="mx-auto max-w-7xl px-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold">The old way</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-gray-300">
            <li>Rewatching 2× speed, still hunting the right minute.</li>
            <li>Questions pile up; replies arrive after class ends.</li>
            <li>Notes scatter across slides, screenshots and tabs.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold">The ClassPartner way</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-gray-300">
            <li>Live transcript that’s searchable as the lecture runs.</li>
            <li>Ask anything; get grounded answers with timestamps.</li>
            <li>Auto highlights and clean notes you can export.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
