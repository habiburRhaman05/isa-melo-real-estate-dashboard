import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

/* Same two fonts as the original HTML:
   - Inter    (400 / 500 / 600 / 700)  -> body, UI, card titles
   - Fraunces (variable, 400 / 500)    -> h1, h2, big stat numbers */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"], // optical size axis, same as the Google Fonts URL (opsz 9..144)
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Isa Melo Real Estate Dashboard",
  description: "Social media board and website leads",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
