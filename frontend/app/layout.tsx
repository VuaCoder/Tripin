import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TRIPRI - Tour Platform",
  description: "Online tour booking platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
