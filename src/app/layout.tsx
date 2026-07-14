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
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html:
          `(function(){try{var t=localStorage.getItem('avoid-nav:theme:v1')||'system';`
          + `var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);`
          + `if(d)document.documentElement.classList.add('dark')}catch(e){}})()` }} />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
