"use client";
import { motion } from "framer-motion";

type Props = {
  text: string;
  className?: string;
  gradient?: boolean;
  type?: "letters" | "word"; // choose render mode
};

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.035, delayChildren: 0.08 },
  },
};

const child = {
  hidden: { opacity: 0, y: "0.6em", filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: "0em",
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

export default function AnimatedTitle({
  text,
  className = "",
  gradient,
  type = "word",
}: Props) {
  if (type === "word") {
    // Single element => gradient spans the whole word
    return (
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={className}
      >
        <span
          className={
            (gradient
              ? "bg-gradient-to-r from-indigo-400 via-indigo-200 to-cyan-300 bg-clip-text text-transparent "
              : "") + "inline-block"
          }
        >
          {text}
        </span>
      </motion.h1>
    );
  }

  // Fallback: per-letter animation (gradient repeats per letter)
  const letters = Array.from(text);
  return (
    <motion.h1 className={className} variants={container} initial="hidden" animate="visible">
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          variants={child}
          style={{ display: "inline-block" }}
          className={
            gradient
              ? "bg-gradient-to-r from-indigo-400 via-indigo-200 to-cyan-300 bg-clip-text text-transparent"
              : ""
          }
          aria-hidden
        >
          {ch === " " ? "\u00A0" : ch}
        </motion.span>
      ))}
    </motion.h1>
  );
}
