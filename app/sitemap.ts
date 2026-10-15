import type { MetadataRoute } from 'next';
import { publicPages, siteOrigin } from '../lib/seo.ts';

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map(page => ({ url: siteOrigin + page.path }));
}
