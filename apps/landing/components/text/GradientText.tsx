"use client";

import { ReactNode } from "react";

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  gradient?: string;
  animate?: boolean;
}

export function GradientText({
  children,
  className = "",
  gradient = "from-primary via-amber-500 to-orange-500",
  animate = false
}: GradientTextProps) {
  return (
    <span
      className={`bg-gradient-to-r ${gradient} bg-clip-text text-transparent ${
        animate ? "animate-gradient-x" : ""
      } ${className}`}
    >
      {children}
    </span>
  );
}
