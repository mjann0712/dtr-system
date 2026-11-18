import type { Metadata } from "next";
import "@fontsource-variable/public-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "DTR System",
  description: "Daily time record computation and reporting for HR",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ ["--font-public-sans" as string]: "'Public Sans Variable'" }}>
      <body>{children}</body>
    </html>
  );
}
