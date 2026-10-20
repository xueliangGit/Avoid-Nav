import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_TITLE = "北京避让导航 - 进京证与交通违章探头智能规避路线规划";
const SITE_DESCRIPTION =
  "基于高德地图的北京进京证与交通监控智能避让导航工具。收录全京 7,260+ 处最新早晚高峰限行、外地车进京抓拍监控与测速摄像头，通过多轮算法智能绕开探头，规划最安全出行路线，支持一键唤起高德地图导航。";
const SITE_KEYWORDS = [
  "北京避让导航",
  "进京证导航",
  "进京证避让路线",
  "北京电子眼分布",
  "北京违章摄像头",
  "北京限行规避",
  "外地车进京路线",
  "早晚高峰避让",
  "进京监控地图",
  "高德地图避让",
  "Avoid-Nav Beijing",
];

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: "%s | 北京避让导航",
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: "Avoid-Nav Team" }],
  creator: "Avoid-Nav",
  publisher: "Avoid-Nav",
  applicationName: "北京避让导航",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://avoid-nav-bj.yamjs.cn/",
    siteName: "北京避让导航",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  formatDetection: {
    telephone: false,
    address: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Schema.org 结构化数据 (WebSite & SoftwareApplication)
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "北京避让导航",
        url: "https://avoid-nav-bj.yamjs.cn/",
        description: SITE_DESCRIPTION,
        inLanguage: "zh-CN",
      },
      {
        "@type": "WebApplication",
        name: "北京避让导航",
        applicationCategory: "NavigationApplication",
        operatingSystem: "Web, iOS, Android",
        description: SITE_DESCRIPTION,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "CNY",
        },
      },
    ],
  };

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              `(function(){try{var t=localStorage.getItem('avoid-nav:theme:v1')||'system';` +
              `var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);` +
              `if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
