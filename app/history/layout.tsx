import type { Metadata } from 'next';
export const metadata: Metadata = { title: '大家搜过什么 · 智商税', description: '查看大家搜索过的产品、搜索次数和最近搜索时间。' };
export default function HistoryLayout({ children }: { children: React.ReactNode }) { return children; }
