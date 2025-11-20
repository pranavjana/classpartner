"use client";

import { ReactNode, useState } from "react";

interface HighlightOnHoverProps {
  children: ReactNode;
  className?: string;
  highlightColor?: string;
}

export function HighlightOnHover({
  children,
  className = "",
  highlightColor = "bg-primary/10",
}: HighlightOnHoverProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <span
      className={`relative inline-block cursor-default transition-all duration-300 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className={`absolute inset-0 -z-10 rounded-md transition-all duration-300 ${highlightColor} ${
          isHovered ? "scale-110 opacity-100" : "scale-100 opacity-0"
        }`}
      />
      <span className={`relative z-10 transition-all duration-300 ${isHovered ? "scale-105" : "scale-100"}`}>
        {children}
      </span>
    </span>
  );
}
