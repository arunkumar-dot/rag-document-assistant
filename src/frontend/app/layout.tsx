import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Lumen",
  description: "Upload documents and ask questions about them.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-white text-gray-900`}>
        <ToastProvider>
          <Nav />
          <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
