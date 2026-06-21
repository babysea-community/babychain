import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

const title = 'BabyChain';
const description =
  'Canvas studio, agentic planner, and durable chain API for image and video model workflows with one final callback.';
const socialImageUrl = 'https://cdn.babysea.live/assets/oss/babychain-card.png';

export const metadata: Metadata = {
  metadataBase: new URL('https://babychain.babysea.live'),
  applicationName: title,
  title: {
    default: title,
    template: `%s | ${title}`,
  },
  description,
  keywords: [
    'babysea',
    'open-source',
    'ai-infrastructure',
    'control-plane',
    'execution-layer',
    'inference-providers',
    'developer-tools',
    'creative-tools',
    'generative-ai',
    'generative-media',
    'aws-aurora',
    'vercel',
    'amazon-nova',
    'aws-s3',
    'vercel-blob',
    'react-flow',
    'semantic-lady',
    'sentry',
  ],
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
    shortcut: ['/favicon.ico'],
  },
  openGraph: {
    title,
    description,
    images: [
      {
        alt: title,
        height: 630,
        url: socialImageUrl,
        width: 1200,
      },
    ],
    siteName: title,
    type: 'website',
    url: '/',
  },
  robots: {
    follow: true,
    index: true,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [socialImageUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="dark" lang="en">
      <body className={`${fontSans.variable} ${fontMono.variable} antialiased`}>
        <Script
          crossOrigin="anonymous"
          data-auto-replace-svg="nest"
          src="https://kit.fontawesome.com/1b8aa472ce.js"
          strategy="lazyOnload"
        />
        {children}
      </body>
    </html>
  );
}
