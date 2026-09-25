import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The face on the shop's logo: Roman inscriptional capitals, in the Trajan
 * tradition. It is a display face — used for the wordmark and nothing else,
 * because all-caps Roman capitals are miserable to read at body sizes.
 */
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dhanvarsha",
  description: "Banarasi silks — sarees, lehengas, suits, kurta sets and more.",
  openGraph: {
    title: "Dhanvarsha Banarasi Silks",
    description: "Woven silks, block prints and bridal pieces, chosen one at a time.",
    images: [{ url: "/brand/dhanvarsha-og.jpg", width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
