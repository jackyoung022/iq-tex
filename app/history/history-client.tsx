'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, History, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import type { PublicHistory } from '@/lib/search-history';

const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai',
}).format(new Date(value));

export default function HistoryClient({ initialData }: { initialData: PublicHistory | null }) {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<PublicHistory | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async (cursor: string | null = null) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError('');
    if (!cursor) setData(null);
    try {
      const params = new URLSearchParams({ q: query });
      if (cursor) params.set('cursor', cursor);
      const response = await fetch(`/api/history?${params}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const next = await response.json() as PublicHistory & { error?: string };
      if (!response.ok) throw new Error(next.error || '搜索记录加载失败。');
      if (pending.current !== controller) return;
      setData(previous => {
        if (!cursor || !previous) return next;
        const seen = new Set(previous.items.map(item => item.id));
        return { ...next, items: [...previous.items, ...next.items.filter(item => !seen.has(item.id))] };
      });
    } catch (e) {
      if (!controller.signal.aborted && pending.current === controller) {
        setError(e instanceof Error ? e.message : '网络连接中断，请重试。');
      }
    } finally { if (pending.current === controller) setLoading(false); }
  }, [query]);

  useEffect(() => {
    setHydrated(true);
    const restoredFromServer = firstLoad.current && initialData !== null;
    firstLoad.current = false;
    if (!restoredFromServer) void load();
    return () => pending.current?.abort();
  }, [load, initialData]);
  const filter = (e: FormEvent) => {
    e.preventDefault();
    const next = draft.trim();
    if (next === query) void load(); else setQuery(next);
  };

  return <div className="app history-app">
    <header className="site-header">
      <a className="brand" href="/" aria-label="智商税首页"><span className="brand-icon">¥<span>?</span></span><span>智商税<span className="brand-dot">.</span></span></a>
      <a href="/" className="history-link"><ArrowLeft size={16}/><span>回去判断</span></a>
    </header>
    <main className="history-main">
      <div className="eyebrow"><History size={13}/> 公开搜索记录</div>
      <h1>大家搜过什么<span className="headline-dot">.</span></h1>
      <p className="history-intro">看看大家买之前，都在想些什么。</p>
      <p className="history-description">展示所有客户提交判断的产品名称，同一产品合并统计。只公开产品、次数和时间，不包含客户身份、API Key 或配置。搜索提交不代表判断成功，接口连接测试不计入。</p>
      <form className="history-filter" onSubmit={filter}>
        <label className="sr-only" htmlFor="history-query">筛选产品名称</label>
        <Search size={18}/>
        <input id="history-query" value={draft} onChange={e => setDraft(e.target.value)} placeholder="搜索记录里的产品名称" maxLength={120} disabled={!hydrated}/>
        <button type="submit" disabled={loading || !hydrated}>筛选</button>
      </form>
      <div className="history-toolbar">
        <p aria-live="polite">{data ? <>{query ? '匹配' : '累计'} <strong>{data.totalProducts.toLocaleString('zh-CN')}</strong> 个产品<span> · </span><strong>{data.totalSearches.toLocaleString('zh-CN')}</strong> 次搜索</> : error ? '搜索记录暂不可用' : '正在读取记录…'}</p>
        <button className="history-link" onClick={() => void load()} disabled={loading || !hydrated}><RefreshCw size={14}/><span>刷新</span></button>
      </div>
      {error && <div className="error-box" role="alert"><span>{error}</span><button onClick={() => void load(data?.nextCursor ?? null)}>重试</button></div>}
      <section className="history-list" aria-label="大家的搜索记录" aria-busy={loading}>
        {data?.items.length ? <ul>{data.items.map(item => <li key={item.id}>
          <div className="history-product"><h2>{item.product}</h2><time dateTime={item.lastSearchedAt}>最近搜索 · {formatDate(item.lastSearchedAt)}</time></div>
          <span className="history-count">搜过 <strong>{item.searchCount.toLocaleString('zh-CN')}</strong> 次</span>
          <a className="history-again" href={`/?product=${encodeURIComponent(item.product)}`} aria-label={`判断 ${item.product}`}>再判断<ArrowUpRight size={15}/></a>
        </li>)}</ul> : data && <div className="history-empty"><History size={30}/><h2>{query ? '没有找到匹配的产品' : '第一条搜索记录，等你来'}</h2><p>{query ? '换个关键词，或清空筛选看看。' : '记录从功能上线后开始积累，之前的搜索没有保存。'}</p><a href="/">去判断一个产品 <ArrowUpRight size={14}/></a></div>}
        {loading && <div className="history-loading" role="status"><LoaderCircle size={16} className="spin"/>正在加载…</div>}
      </section>
      {data?.nextCursor && !error && <button className="history-more" disabled={loading || !hydrated} onClick={() => void load(data.nextCursor)}>加载更多</button>}
      {data && data.items.length > 0 && !data.nextCursor && !loading && <p className="history-end">已展示{query ? '全部匹配' : '全部'}产品 · 时间为北京时间</p>}
    </main>
    <footer><span>智商税<span className="brand-dot">.</span> / 为理性消费做一点小事</span><span>AI 判断仅供参考</span></footer>
  </div>;
}
