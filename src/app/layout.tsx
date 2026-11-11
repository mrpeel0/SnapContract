import type { Metadata } from "next";
import { Caveat, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const signature = Caveat({ variable: "--font-signature", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "SnapContract · Change orders from the conversation",
  description: "An AI agent that turns contractor-client texts on WhatsApp, iMessage and Telegram into priced, signed change orders and accurate invoices.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${signature.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
