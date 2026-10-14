import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '智商税 · 买之前，想明白', description: '输入产品名称，联网核对信息，用 AI 帮你看清功效与溢价。', icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}</body></html>; }
