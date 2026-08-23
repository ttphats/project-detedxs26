import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { Header, Footer, MobileBottomNav } from "@/components";
import SmoothScroll from "@/components/providers/SmoothScroll";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

const SITE_TITLE = "TEDxFPTUniversityHCMC 2026 - THE RIGHT TIME";
const SITE_DESCRIPTION =
  "TEDxFPTUniversityHCMC 2026: THE RIGHT TIME - Book your tickets now to join the biggest TEDx event at FPTU HCMC.";
/** Event banner, also used as the link-preview image. */
const SITE_IMAGE =
  "https://res.cloudinary.com/dug62fhtq/image/upload/v1787450118/tedx-fptuhcmc/events/ze7b6n0lxq5so7o8fykh.jpg";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  // Declared explicitly rather than left to each scraper's <title> fallback,
  // which is what decides the card when a link is pasted into Facebook,
  // Messenger or Zalo.
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "TEDxFPTUniversityHCMC",
    type: "website",
    locale: "vi_VN",
    images: [{url: SITE_IMAGE, width: 1200, height: 630, alt: SITE_TITLE}],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-black`}>
        <SmoothScroll>
          <Toaster
            position="top-center"
            richColors
            toastOptions={{
              style: {
                background: "#1a1a1a",
                border: "1px solid #333",
                color: "#fff",
              },
            }}
          />
          <Header />
          <main className="min-h-screen pb-20 md:pb-0">{children}</main>
          <Footer />
          <MobileBottomNav />
        </SmoothScroll>
      </body>
    </html>
  );
}
