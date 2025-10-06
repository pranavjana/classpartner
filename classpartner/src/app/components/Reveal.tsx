"use client";
import { motion } from "framer-motion";
import { PropsWithChildren } from "react";

export default function Reveal({
  children,
  delay = 0,
}: PropsWithChildren<{ delay?: number }>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}               // smaller offset
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}        // animate only once
      transition={{ duration: 0.35, ease: "easeOut", delay }} // shorter duration
    >
      {children}
    </motion.div>
  );
}
