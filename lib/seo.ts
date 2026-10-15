import type { Metadata } from 'next';

// Keep canonical URLs, the sitemap and structured data on the same public origin.
export const siteOrigin = 'https://iq-tex.jackyra.com';
export const siteName = '智商税';
export const publicPages = [
  { path: '/', title: '智商税判断工具｜AI 产品分析与理性消费助手', description: '输入产品名称，联网核对功效、价格与公开评测，用 AI 综合分析智商税风险，查看判断理由、购买建议和资料来源。支持手机、电脑及自带模型 API Key。' },
  { path: '/history', title: '大家搜过什么｜产品搜索记录与消费关注点 · 智商税', description: '查看大家搜索过的产品、搜索次数和最近搜索时间，发现消费关注点。支持筛选产品名称并返回智商税判断工具进行分析，记录不含客户身份或 API 密钥。' },
] as const;

export function pageMetadata(index: 0 | 1): Metadata {
  const page = publicPages[index];
  const url = siteOrigin + page.path;
  return {
    metadataBase: new URL(siteOrigin), title: page.title, description: page.description,
    applicationName: siteName,
    alternates: { canonical: url },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 } },
    openGraph: { title: page.title, description: page.description, url, type: 'website', siteName, locale: 'zh_CN' },
    twitter: { card: 'summary', title: page.title, description: page.description },
  };
}

export const websiteSchema = {
  '@context': 'https://schema.org', '@type': 'WebSite', '@id': siteOrigin + '/#website',
  url: siteOrigin + '/', name: siteName, alternateName: ['智商税判断助手', 'IQ Tax Check'],
  description: publicPages[0].description, inLanguage: 'zh-CN',
};

export function webpageSchema(index: 0 | 1) {
  const page = publicPages[index];
  return {
    '@context': 'https://schema.org', '@type': index === 0 ? 'WebPage' : 'CollectionPage',
    '@id': siteOrigin + page.path + '#webpage', url: siteOrigin + page.path,
    name: page.title, description: page.description, inLanguage: 'zh-CN',
    isPartOf: { '@id': websiteSchema['@id'] },
  };
}

export function jsonLd(value: unknown) { return JSON.stringify(value).replace(/</g, '\\u003c'); }
