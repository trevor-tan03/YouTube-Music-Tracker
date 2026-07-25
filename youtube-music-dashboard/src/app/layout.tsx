import Navbar from "@/components/custom-components/Navbar";
import { ThemeProvider } from "@/components/theme-provider";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "YouTube Music Tracker",
    description: "Manage your YouTube listening",
};

interface RootLayoutProps {
    children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
    return (
        <>
            <html
                lang="en"
                className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
                suppressHydrationWarning
            >
                <head />
                <body>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        <Navbar />
                        {children}
                    </ThemeProvider>
                </body>
            </html>
        </>
    );
}
