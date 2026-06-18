import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = siteUrl();
const TITLE = "GitGrilled — Get interviewed on your own code";
const DESCRIPTION =
  "Paste a public GitHub repo. An AI reads the whole codebase and grills you like a senior engineer would — architecture, trade-offs, bugs, scaling — then scores you. No softballs.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "GitGrilled",
  keywords: [
    "technical interview",
    "AI interviewer",
    "code review",
    "GitHub",
    "mock interview",
    "software engineering",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "GitGrilled",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "GitGrilled" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
