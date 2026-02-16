import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Setaruf membantu Anda menemukan pasangan hidup melalui proses ta’aruf Islami yang terstruktur, aman, dan berbasis asesmen psikologi, dan juga bisa digunakan oleh semua Kalangan dan Agama",
  description: "Setaruf membantu Anda menemukan pasangan hidup melalui proses ta’aruf Islami yang terstruktur, aman, dan berbasis asesmen psikologi, dan juga bisa digunakan oleh semua Kalangan dan Agama",
  keywords: ["Z.ai", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui", "AI development", "React"],
  authors: [{ name: "Z.ai Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Setaruf membantu Anda menemukan pasangan hidup melalui proses ta’aruf Islami yang terstruktur, aman, dan berbasis asesmen psikologi, dan juga bisa digunakan oleh semua Kalangan dan Agama",
    description: "Setaruf membantu Anda menemukan pasangan hidup melalui proses ta’aruf Islami yang terstruktur, aman, dan berbasis asesmen psikologi, dan juga bisa digunakan oleh semua Kalangan dan Agama",
    url: "https://chat.z.ai",
    siteName: "Z.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Setaruf membantu Anda menemukan pasangan hidup melalui proses ta’aruf Islami yang terstruktur, aman, dan berbasis asesmen psikologi, dan juga bisa digunakan oleh semua Kalangan dan Agama",
    description: "Setaruf membantu Anda menemukan pasangan hidup melalui proses ta’aruf Islami yang terstruktur, aman, dan berbasis asesmen psikologi, dan juga bisa digunakan oleh semua Kalangan dan Agama",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
