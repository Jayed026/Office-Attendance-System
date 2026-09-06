import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "F10S Attendance",
  description: "F10S Employee Attendance System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
