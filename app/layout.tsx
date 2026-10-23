import type { Metadata } from "next"
import { Fraunces, Inter } from "next/font/google"

import { Providers } from "@/components/providers"

import "./globals.css"

/* Same two fonts as the source design:
   - Inter    (400 / 500 / 600 / 700)  -> body, UI, card titles
   - Fraunces (variable, 400 / 500)    -> h1, h2, big stat numbers */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Isa Melo Real Estate Dashboard",
  description: "Social media board and website leads",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
