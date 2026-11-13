import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/store/Providers";
import { GlobalSiteShell } from '@/components/layout/GlobalSiteShell';
import { RoutePreloader } from '@/components/preloader/RoutePreloader';

export const metadata: Metadata = {
  title: "Tripri - Du lịch theo cách của bạn",
  description: "Nền tảng đặt phòng, vé xe, tour & trải nghiệm bản địa toàn diện tại Việt Nam.",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen text-slate-800 antialiased">
        <Providers>
          <RoutePreloader />
          <GlobalSiteShell>{children}</GlobalSiteShell>
        </Providers>
      </body>
    </html>
  );
}
