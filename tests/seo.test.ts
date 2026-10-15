import test from 'node:test';
import assert from 'node:assert/strict';
import robots from '../app/robots.ts';
import sitemap from '../app/sitemap.ts';
import { jsonLd, pageMetadata, publicPages, siteOrigin, websiteSchema, webpageSchema } from '../lib/seo.ts';

test('crawler discovery lists only canonical public pages and leaves render assets crawlable', () => {
  const rules = robots();
  assert.deepEqual(rules.rules, { userAgent: '*', allow: '/', disallow: '/api/' });
  assert.equal(rules.sitemap, siteOrigin + '/sitemap.xml');
  const urls = sitemap().map(item => item.url);
  assert.deepEqual(urls, [siteOrigin + '/', siteOrigin + '/history']);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every(value => { const url = new URL(value); return url.protocol === 'https:' && !url.search && !url.pathname.startsWith('/api'); }));
});

test('each public page has a distinct canonical and consistent search and sharing metadata', () => {
  for (const index of [0, 1] as const) {
    const metadata = pageMetadata(index);
    const canonical = siteOrigin + publicPages[index].path;
    assert.equal(metadata.alternates?.canonical, canonical);
    assert.equal(metadata.openGraph?.url, canonical);
    assert.equal(metadata.title, publicPages[index].title);
    assert.equal(metadata.openGraph?.title, metadata.title);
    assert.ok(typeof metadata.robots === 'object' && metadata.robots?.index && metadata.robots?.follow);
  }
  assert.notEqual(pageMetadata(0).alternates?.canonical, pageMetadata(1).alternates?.canonical);
});

test('structured data describes the real site without fabricated ratings and escapes script boundaries', () => {
  assert.equal(websiteSchema.url, pageMetadata(0).alternates?.canonical);
  assert.equal(webpageSchema(1).isPartOf['@id'], websiteSchema['@id']);
  assert.equal(webpageSchema(1)['@type'], 'CollectionPage');
  assert.ok(!jsonLd(websiteSchema).includes('aggregateRating'));
  const value = { text: '</script><script>alert(1)</script>' };
  const serialized = jsonLd(value);
  assert.ok(!serialized.includes('<'));
  assert.deepEqual(JSON.parse(serialized), value);
});
