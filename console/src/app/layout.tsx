import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NimRoute — LLM Routing Gateway",
  description:
    "Metered, OpenAI-compatible LLM routing. Cheap NVIDIA NIM models with automatic fallback, tenant API keys, and per-token cost.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
