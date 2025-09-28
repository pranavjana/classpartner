export default function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-16">
      <h2 className="text-center text-2xl font-semibold">Simple pricing</h2>
      <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h3 className="text-lg font-semibold">Free</h3>
          <p className="mt-2 text-sm text-gray-300">Great for individuals</p>
          <ul className="mt-4 space-y-2 text-sm text-gray-300">
            <li>• Record & upload</li>
            <li>• Real-time Q&A</li>
            <li>• Searchable transcript</li>
          </ul>
          <a href="/app" className="mt-6 inline-block rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500">
            Start now
          </a>
        </div>
        <div className="rounded-2xl border border-indigo-700 bg-gray-900 p-6">
          <h3 className="text-lg font-semibold">Pro</h3>
          <p className="mt-2 text-sm text-gray-300">For power learners & instructors</p>
          <ul className="mt-4 space-y-2 text-sm text-gray-300">
            <li>• Everything in Free</li>
            <li>• More recording hours</li>
            <li>• Exports, highlights, chapters</li>
          </ul>
          <a href="/app" className="mt-6 inline-block rounded-xl border border-indigo-600 px-5 py-3 text-sm font-semibold text-indigo-300 hover:bg-gray-900">
            Go Pro
          </a>
        </div>
      </div>
    </section>
  );
}
