"use client";
import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="font-semibold tracking-tight">ClassPartner</Link>
        <nav className="flex items-center gap-6 text-sm">
          <a href="#features" className="text-gray-300 hover:text-white">Product</a>
          <a href="#how-it-works" className="text-gray-300 hover:text-white">How it works</a>
          <a href="#pricing" className="text-gray-300 hover:text-white">Pricing</a>
          <Link
            href="/app"
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-gray-100 hover:bg-gray-900"
          >
            Open app
          </Link>
        </nav>
      </div>
    </header>
  );
}
