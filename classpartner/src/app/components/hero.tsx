import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="mx-auto h-[42rem] max-w-7xl blur-3xl opacity-30"
             style={{background:
              "radial-gradient(600px 300px at 20% 20%, #6366f1, transparent 60%), radial-gradient(600px 300px at 80% 20%, #22d3ee, transparent 60%)"}}/>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-20 pb-16 text-center sm:pt-28 sm:pb-24">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">
          <span className="bg-gradient-to-r from-indigo-400 via-indigo-200 to-cyan-300 bg-clip-text text-transparent">
            ClassPartner
          </span>
        </h1>
        <p className="mt-5 text-2xl font-semibold text-gray-100 sm:text-3xl">
          Pause less. Understand more.
        </p>
        <p className="mx-auto mt-6 max-w-3xl text-lg text-gray-300">
          Record lectures and videos, ask questions in real time, and jump to the exact moment that explains the answer.
          It’s like having a teaching assistant inside the timeline.
        </p>
        <div className="mt-9 flex items-center justify-center gap-4">
          <Link href="/demo"
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-500">
            Try live demo
          </Link>
          <Link href="/upload"
            className="rounded-xl border border-gray-700 px-5 py-3 text-sm font-semibold text-gray-200 hover:bg-gray-900">
            Upload a video
          </Link>
        </div>
        <p className="mt-4 text-xs text-gray-400">Your media stays private unless you share it.</p>
      </div>
    </section>
  );
}
