"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import AnimatedTitle from "./AnimatedTitle";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gray-950 text-white">
      {/* lighter animated glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute left-1/2 top-[-10%] h-[24rem] w-[24rem] -translate-x-1/2 
                     rounded-full opacity-10 blur-2xl animate-gradient-x 
                     bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500"
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
      <AnimatedTitle
        text="ClassPartner"
        gradient
        type="word" 
        className="text-5xl font-extrabold tracking-tight sm:text-7xl"
/>

      
      <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.35 }}
          className="mt-5 text-2xl font-semibold text-gray-100 sm:text-3xl"
        >
          Pause less. Understand more.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.5 }}
          className="mx-auto mt-6 max-w-3xl text-lg text-gray-300"
        >
          ClassPartner listens through your laptop microphone while you attend lectures or play videos. 
          Ask questions in real time and jump to the exact explanation.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.65 }}
          className="mt-9 flex items-center justify-center gap-4"
        >
          <Link href="/demo" className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-500">
            Try live demo
          </Link>
          <Link href="/app" className="rounded-xl border border-gray-700 px-5 py-3 text-sm font-semibold text-gray-200 hover:bg-gray-900">
            Start recording
          </Link>
        </motion.div>
      </div>
    </section>
  );
}