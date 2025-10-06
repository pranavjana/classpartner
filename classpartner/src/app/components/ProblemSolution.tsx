import Reveal from "./Reveal";

export default function ProblemSolution() {
  return (
    <section className="mx-auto max-w-7xl px-6">
      <div className="grid gap-8 md:grid-cols-2">
        <Reveal>
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold">The old way</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-gray-300">
            <li>You spend hours pausing/replaying videos</li>
            <li>You pay constant attention to catch key points</li>
            <li>Unanswered questions stay unanswered</li>
          </ul>
        </div>
        </Reveal>

        <Reveal delay={0.1}>
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold">The ClassPartner way</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-gray-300">
            <li>Record directly through your laptop microphone — no uploads, no hassle.</li>
            <li>Ask questions live while the class runs.</li>
            <li>Get instant answers grounded in the spoken lecture.</li>
          </ul>
        </div>
        </Reveal>
      </div>
    </section>
  );
}
