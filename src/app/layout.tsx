import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avoid-Nav Beijing",
  description: "北京避让导航工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
