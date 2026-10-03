import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tripri - Du lịch theo cách của bạn",
  description: "Nền tảng đặt phòng, vé xe, tour & trải nghiệm bản địa toàn diện tại Việt Nam.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen text-slate-800 antialiased">
        {children}
      </body>
    </html>
  );
}
