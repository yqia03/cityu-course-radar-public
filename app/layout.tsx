import type { Metadata } from "next";
import "./globals.css";
import "./materials.css";
import { RadarProvider } from "@/components/radar-provider";

export const metadata: Metadata = {
  title: "城课雷达 · CityU Course Radar",
  description: "香港城市大学三语课程评价社区：发现好课，分享真实体验。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hans">
      <body className="antialiased">
        <RadarProvider>{children}</RadarProvider>
      </body>
    </html>
  );
}
