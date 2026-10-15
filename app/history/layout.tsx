import type { Metadata } from 'next';
import { jsonLd, pageMetadata, webpageSchema } from '@/lib/seo';
export const metadata: Metadata = pageMetadata(1);
export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(webpageSchema(1)) }}/>{children}</>;
}
