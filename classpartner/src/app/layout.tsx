import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ClassPartner — Record, ask, understand",
  description:
    "Record lectures & videos, ask real-time questions, and jump to exact explanations.",
  openGraph: {
    title: "ClassPartner — Record, ask, understand",
    description:
      "Interactive lectures with real-time Q&A and searchable transcripts.",
    url: "https://your-domain.com",
    siteName: "ClassPartner",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ClassPartner" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-gray-950 text-gray-100">
        {children}
      </body>
    </html>
  );
}
