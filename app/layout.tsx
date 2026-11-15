import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plan B — Answers and next steps",
  description: "A general web research assistant powered by Exa. Ask questions, compare sources and prepare your next steps.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
