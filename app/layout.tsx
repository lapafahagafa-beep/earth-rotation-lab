import type { Metadata } from 'next';
import './globals.css';

const siteOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://earth-rotation-lab.lapafahagafa.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: '地球自转与昼夜交替｜交互实验室',
  description: '面向地理课堂的地球自转、公转、昼夜与节气交互模拟器。',
  openGraph: {
    title: '地球自转与昼夜交替',
    description: '拖动地球、切换极地视角，在二十四节气中观察晨昏线与太阳直射点的全年变化。',
    type: 'website',
    locale: 'zh_CN',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '地球自转与昼夜交替交互式地理实验室' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '地球自转与昼夜交替',
    description: '交互式地理实验室：观察晨昏线、太阳直射点与极昼极夜。',
    images: ['/og.png'],
  },
  icons: { icon: '/og.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
