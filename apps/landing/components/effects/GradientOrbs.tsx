"use client";

export function GradientOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Large orange orb */}
      <div
        className="absolute -top-40 -right-40 h-96 w-96 animate-float rounded-full bg-primary/20 blur-3xl"
        style={{ animationDuration: "8s" }}
      />

      {/* Medium amber orb */}
      <div
        className="absolute top-1/4 -left-32 h-80 w-80 animate-float-delayed rounded-full bg-amber-400/15 blur-3xl"
        style={{ animationDuration: "10s" }}
      />

      {/* Small peach orb */}
      <div
        className="absolute bottom-1/4 right-1/4 h-64 w-64 animate-float rounded-full bg-orange-300/20 blur-3xl"
        style={{ animationDuration: "7s", animationDelay: "1s" }}
      />
    </div>
  );
}
