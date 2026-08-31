import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-sr", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SukaReview — Suka Shawarma Review Monitor",
  description: "Google Review Monitoring for Suka Shawarma",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${archivo.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
