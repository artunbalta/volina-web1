import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { NextAuthProvider } from "@/components/providers/NextAuthProvider";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Volina AI | Intelligent Voice Agent Platform",
  description: "Production-grade AI Voice Agent SaaS platform for appointment scheduling, call management, and CRM across all industries.",
  keywords: ["AI", "Voice Agent", "Appointment Scheduling", "CRM", "SaaS", "Business Automation"],
  authors: [{ name: "Volina Team" }],
  icons: {
    icon: "/VolinaLogo.png",
    shortcut: "/VolinaLogo.png",
    apple: "/VolinaLogo.png",
  },
  openGraph: {
    title: "Volina AI | Intelligent Voice Agent Platform",
    description: "Production-grade AI Voice Agent SaaS platform for appointment scheduling, call management, and CRM across all industries.",
    url: "https://volina.ai",
    siteName: "Volina AI",
    type: "website",
    images: [
      {
        url: "/VolinaLogo.png",
        width: 512,
        height: 512,
        alt: "Volina AI Logo",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className={`${inter.className} antialiased`}>
        <NextAuthProvider>
          <SupabaseProvider>
            {children}
          </SupabaseProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
