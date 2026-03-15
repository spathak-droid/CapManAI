import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { StudentAnalysisProvider } from "@/contexts/StudentAnalysisContext";
import NavBar from "@/components/NavBar";
import FloatingAssistantWidget from "@/components/FloatingAssistantWidget";
import ChallengeToast from "@/components/ChallengeToast";
import PrefetchData from "@/components/PrefetchData";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CapMan AI — Master Trading Through AI-Powered Scenarios",
  description:
    "Gamified trading scenario training powered by AI. Practice capital management with real-world scenarios, get graded, and level up.",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans antialiased bg-body-gradient`}
      >
        <AuthProvider>
          <RealtimeProvider>
            <StudentAnalysisProvider>
              <PrefetchData />
              <NavBar />
              <main>{children}</main>
              <FloatingAssistantWidget />
              <ChallengeToast />
            </StudentAnalysisProvider>
          </RealtimeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
