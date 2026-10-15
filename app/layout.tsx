import type { Metadata } from 'next';
import { jsonLd, pageMetadata, websiteSchema } from '@/lib/seo';
import './globals.css';
export function generateMetadata(): Metadata {
  const verification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  return { ...pageMetadata(0), icons: { icon: '/favicon.svg' }, ...(verification ? { verification: { google: verification } } : {}) };
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(websiteSchema) }}/>{children}</body></html>;
}
