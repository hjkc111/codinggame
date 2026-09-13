import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codefront · 代码战场",
  description: "用 Python 指挥机器人小队，实时训练，与朋友争夺能源核心。",
  other: {
    "codex-preview": "development",
  },
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
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
