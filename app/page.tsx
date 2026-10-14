'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, ArrowRight, Check, ChevronDown, CircleHelp, ExternalLink, LoaderCircle, Search, Settings2, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { Analysis, Settings } from '@/lib/analysis';

type StoredSettings = { baseUrl: string; model: string; hasApiKey: boolean; hasTavilyKey: boolean };
type Config = { llmConfigured: boolean; searchConfigured: boolean; baseUrl: string; model: string };
const examples = ['石墨烯发热内衣', '戴森吹风机', '胶原蛋白口服液'];
const providers = [
  { name: 'OpenAI', url: 'https://api.openai.com/v1' },
  { name: 'DeepSeek', url: 'https://api.deepseek.com/v1' },
  { name: '通义千问', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { name: 'Moonshot', url: 'https://api.moonshot.cn/v1' },
  { name: '硅基流动', url: 'https://api.siliconflow.cn/v1' },
  { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
];

export default function Home() {
  const [product, setProduct] = useState('');
  const [result, setResult] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<Config | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [draft, setDraft] = useState<Settings>({});
  const [saved, setSaved] = useState(false);
  const [stored, setStored] = useState<StoredSettings | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const [searchTesting, setSearchTesting] = useState(false);
  const [searchTest, setSearchTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const methodDialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const configRequest = fetch('/api/config').then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<Config>; }).then(setConfig).catch(() => setError('暂时无法读取服务配置，请刷新页面。'));
    const settingsRequest = fetch('/api/settings').then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<StoredSettings>; }).then(data => {
      setStored(data);
      if (data.baseUrl || data.model) setSettings({ baseUrl: data.baseUrl, model: data.model });
    }).catch(() => setError('暂时无法恢复浏览器中保存的配置，请稍后刷新重试。'));
    void Promise.allSettled([configRequest, settingsRequest]).then(() => setRestoring(false));
    return () => controller.current?.abort();
  }, []);
  useEffect(() => { if (!loading) return; setElapsed(0); const interval = setInterval(() => setElapsed(s => s + 1), 1000); return () => clearInterval(interval); }, [loading]);

  const customBase = !!settings.baseUrl && settings.baseUrl.replace(/\/+$/, '') !== (config?.baseUrl || providers[0].url).replace(/\/+$/, '');
  const draftCustomBase = !!draft.baseUrl && draft.baseUrl.replace(/\/+$/, '') !== (config?.baseUrl || providers[0].url).replace(/\/+$/, '');
  const sameSavedBase = !!stored?.baseUrl && (settings.baseUrl || config?.baseUrl || providers[0].url).replace(/\/+$/, '') === stored.baseUrl.replace(/\/+$/, '');
  const savedKeyUsable = !!stored?.hasApiKey && !!stored?.baseUrl && (draft.baseUrl || config?.baseUrl || providers[0].url).replace(/\/+$/, '') === stored.baseUrl.replace(/\/+$/, '');
  const serverDefaultUsable = !!config?.llmConfigured && !draftCustomBase;
  const serverKeyUsable = serverDefaultUsable || savedKeyUsable;
  const configured = ((!customBase && config?.llmConfigured) || ((!!settings.apiKey || (sameSavedBase && stored?.hasApiKey)) && !!settings.model)) && (config?.searchConfigured || !!settings.tavilyKey || stored?.hasTavilyKey);
  const openSettings = () => { setDraft({ baseUrl: config?.baseUrl || providers[0].url, model: config?.model || '', ...settings }); setSaved(false); setSearchTest(null); setStorageMessage(''); settingsDialog.current?.showModal(); };
  const testSearch = async () => {
    if (searchTesting) return;
    setSearchTesting(true); setSearchTest(null);
    try {
      const response = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product: product.trim().length >= 2 ? product.trim() : '戴森吹风机', tavilyKey: draft.tavilyKey?.trim() }), signal: AbortSignal.timeout(55000) });
      const data = await response.json() as { count: number; provider: string; error?: string; warnings?: string[] };
      if (!response.ok) throw new Error(data.error || '联网搜索测试失败，请重试。');
      setSearchTest({ ok: data.count > 0, text: data.count > 0 ? `联网搜索可用，已找到 ${data.count} 条资料（${data.provider}）。${data.warnings?.length ? '已自动使用备用搜索。' : ''}` : '搜索服务已连接，但本次没有检索到资料，请尝试更具体的产品名。' });
    } catch (e) { setSearchTest({ ok: false, text: e instanceof Error && e.name === 'TimeoutError' ? '联网搜索等待超时，请稍后重试。' : e instanceof Error ? e.message : '联网搜索测试失败。' }); }
    finally { setSearchTesting(false); }
  };
  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setStorageMessage('');
    try {
      const next = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, (v || '').trim()]));
      const response = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      const data = await response.json() as StoredSettings & { error?: string };
      if (!response.ok) throw new Error(data.error || '浏览器配置保存失败，请重试。');
      const confirmation = await fetch('/api/settings');
      if (!confirmation.ok) throw new Error('配置保存后无法确认，请重试。');
      const restored = await confirmation.json() as StoredSettings;
      if ((data.hasApiKey && !restored.hasApiKey) || (data.hasTavilyKey && !restored.hasTavilyKey)) throw new Error('浏览器未允许保存 Cookie，请允许本网站 Cookie 后重试。');
      setStored(restored);
      // Keep restored/confirmed metadata only; saved plaintext keys leave React state.
      const metadata = { baseUrl: data.baseUrl, model: data.model };
      setSettings(metadata); setDraft(metadata);
      setSaved(true); settingsDialog.current?.close(); setError('');
    } catch (e) { setStorageMessage(e instanceof Error ? e.message : '浏览器配置保存失败，请重试。'); }
    finally { setSaving(false); }
  };
  const forgetSettings = async () => {
    if (saving || searchTesting) return;
    setSaving(true); setStorageMessage('');
    try {
      const response = await fetch('/api/settings', { method: 'DELETE' });
      const data = await response.json() as StoredSettings & { error?: string };
      if (!response.ok) throw new Error(data.error || '清除配置失败，请重试。');
      setStored(data); setSettings({}); setDraft({ baseUrl: config?.baseUrl || providers[0].url, model: config?.model || '' });
      setSaved(false); setSearchTest(null); setError(''); setStorageMessage('已清除本浏览器保存的配置与密钥。');
    } catch (e) { setStorageMessage(e instanceof Error ? e.message : '清除配置失败，请重试。'); }
    finally { setSaving(false); }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!configured) { openSettings(); return; }
    const name = product.trim();
    if (name.length < 2) { setError('输入具体一点的产品名称，至少 2 个字。'); input.current?.focus(); return; }
    setLoading(true); setError(''); setResult(null); setSourcesOpen(false);
    controller.current = new AbortController();
    const timer = setTimeout(() => controller.current?.abort(), 100000);
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product: name, settings }), signal: controller.current.signal });
      const data = await response.json() as Analysis & { error?: string };
      if (!response.ok) throw new Error(data.error || '暂时无法完成判断，请重试。');
      setResult(data);
    } catch (e) { setError(e instanceof Error && e.name === 'AbortError' ? '本次判断等待超时，请稍后重试。' : e instanceof Error ? e.message : '网络连接中断，请重试。'); }
    finally { clearTimeout(timer); setLoading(false); }
  };
  const risk = result?.probability;
  const tone = risk == null ? 'unknown' : risk >= 70 ? 'high' : risk >= 40 ? 'medium' : 'low';
  const clear = () => { setProduct(''); setResult(null); setError(''); input.current?.focus(); };

  return <div className="app">
    <header className="site-header">
      <a className="brand" href="/" aria-label="智商税首页"><span className="brand-icon">¥<span>?</span></span><span>智商税<span className="brand-dot">.</span></span></a>
      <div className="header-actions"><span className="header-caption">让每一笔钱，花得明白。</span><button className="icon-button settings-button" onClick={openSettings} disabled={restoring || saving} aria-label="接口设置"><Settings2 size={18}/><span>设置</span></button></div>
    </header>

    <main>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="eyebrow"><span className="status-dot"/> AI 消费判断助手</div>
        <h1 id="hero-heading">买之前，<br className="mobile-break"/>想明白<span className="headline-dot">.</span></h1>
        <p className="hero-description">是真有用，还是概念的溢价？<br className="mobile-break"/>让信息帮你做决定。</p>

        <form className="search-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="product">产品名称</label>
          <Search className="search-icon" size={22}/>
          <input ref={input} id="product" name="product" value={product} onChange={e => { setProduct(e.target.value); if (error) setError(''); }} placeholder="输入产品名称，看看值不值得买" maxLength={120} autoComplete="off" disabled={loading} required minLength={2}/>
          {product && !loading && <button type="button" className="clear-button" onClick={clear} aria-label="清空产品名称"><X size={17}/></button>}
          <button className="submit-button" disabled={loading || restoring} type="submit">{loading ? <><LoaderCircle size={17} className="spin"/><span>判断中</span></> : <><span>判断一下</span><ArrowRight size={18}/></>}</button>
        </form>
        <div className="examples"><span>试着搜搜</span>{examples.map(name => <button key={name} disabled={loading} onClick={() => { setProduct(name); setError(''); input.current?.focus(); }}>{name}<ArrowUpRight size={12}/></button>)}</div>
        {saved && <p className="saved-note" role="status"><Check size={14}/>设置已保存至本浏览器，刷新后自动恢复，有效期 30 天。</p>}
        {config && !configured && !saved && <p className="setup-note">首次使用，<button onClick={openSettings}>连接你的 AI 接口 <ArrowUpRight size={12}/></button></p>}
        {error && <div className="error-box" role="alert"><CircleHelp size={18}/><span>{error}</span><button type="button" onClick={openSettings}>检查设置</button></div>}
      </section>

      <section className={`result-panel ${result ? `has-result ${tone}` : ''}`} aria-label="判断结果" aria-live="polite" aria-busy={loading}>
        {loading ? <div className="loading-state"><div className="loading-orbit"><Search size={29}/></div><h2>给这次心动，做个事实检查</h2><p>正在联网检索产品资料，并由 AI 综合分析。</p><div className="loading-meta"><LoaderCircle size={13} className="spin"/> 通常需要 10–60 秒 <span>·</span> 已等待 {elapsed} 秒</div></div> : result ? <>
          <div className="result-header"><span className="section-label"><span className="status-dot"/> 本次判断</span><span className="evidence-badge">{result.evidence === 'sufficient' ? '证据相对充分' : result.evidence === 'limited' ? '证据有限' : '证据不足'}</span></div>
          <div className="score-layout"><div className="score-block"><span className="score-label">智商税概率</span><div className="score-number">{risk == null ? '—' : risk}<span>{risk == null ? '' : '%'}</span></div><span className="score-qualifier">AI 主观风险估计</span></div><div className="conclusion"><h2>{result.verdict}</h2><p className="result-product">{result.product}</p><p>{result.summary}</p></div></div>
          {risk != null && <div className="risk-scale" aria-label={`智商税风险 ${risk}%`}><div className="risk-line"><span style={{ left: `clamp(6px, ${risk}%, calc(100% - 6px))` }}/></div><div className="scale-labels"><span>较低风险</span><span>较高风险</span></div></div>}
          <div className="reasons">{result.reasons.map((r, i) => <div className="reason" key={i}><span className="reason-index">0{i + 1}</span><div><h3>{r.title}</h3><p>{r.detail} {r.sourceIds.map(id => <a className="citation" key={id} href={result.sources.find(s => s.id === id)?.url} target="_blank" rel="noopener noreferrer" aria-label={`查看来源 ${id}`}>[{id}]</a>)}</p></div></div>)}</div>
          <div className="advice"><Sparkles size={18}/><div><h3>买之前，想一想</h3><p>{result.advice}</p></div></div>
          <p className="uncertainty"><CircleHelp size={14}/><span>{result.uncertainty}</span></p>
          {result.warnings.map(w => <p className="warning-note" key={w}>{w}</p>)}
          <div className="sources-section"><button className="sources-toggle" onClick={() => setSourcesOpen(v => !v)} aria-expanded={sourcesOpen} aria-controls="source-list"><span>本次检索来源 <span className="source-count">{result.sources.length}</span></span><ChevronDown size={16} className={sourcesOpen ? 'rotated' : ''}/></button>{sourcesOpen && <div id="source-list" className="source-list">{result.sources.map(s => <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"><span className="source-id">{s.id.toString().padStart(2, '0')}</span><span><strong>{s.title}</strong><small>{s.domain}</small></span><ExternalLink size={14}/></a>)}{!result.sources.length && <p>本次没有可用来源。</p>}<p className="source-footnote">展示检索摘要；完整内容请打开原文核对。{new Date(result.searchedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })} · {result.searchProvider}{result.laya.status === 'used' ? ' · Laya 辅助已使用' : ''}</p></div>}</div>
        </> : <div className="empty-state"><div className="empty-icon"><ShieldCheck size={30} strokeWidth={1.4}/><span className="tiny-star">✦</span></div><h2>你的钱包，值得多想一下。</h2><p>输入一个产品，让我们从证据开始。</p><div className="empty-steps"><span><span>01</span> 联网找信息</span><i/><span><span>02</span> AI 看证据</span><i/><span><span>03</span> 给你一个判断</span></div></div>}
      </section>

      <div className="under-panel"><span><ShieldCheck size={14}/>基于公开信息，保留独立判断</span><button onClick={() => methodDialog.current?.showModal()}>我们怎么判断？<ArrowUpRight size={14}/></button></div>
      <div className="philosophy"><span className="philosophy-line"/><p>少一点冲动，多一点清醒。</p><span className="philosophy-line"/></div>
    </main>
    <footer><span>智商税<span className="brand-dot">.</span> <span className="footer-separator">/</span> 为理性消费做一点小事</span><span>AI 判断仅供参考</span></footer>

    <dialog ref={settingsDialog} className="modal" onClick={e => { if (e.target === e.currentTarget) settingsDialog.current?.close(); }}>
      <div className="modal-heading"><div><span className="section-label">连接服务</span><h2>你的 AI，你的判断。</h2></div><button className="icon-button" aria-label="关闭设置" onClick={() => settingsDialog.current?.close()}><X size={20}/></button></div>
      <p className="modal-intro">支持 OpenAI 兼容接口。配置与密钥以加密 Cookie 保存在本浏览器 30 天，刷新后自动恢复；服务器不持久化保存客户密钥。</p>
      <form onSubmit={saveSettings} className="settings-form">
        <label>接口地址 <span>Base URL</span><input type="url" value={draft.baseUrl || ''} onChange={e => setDraft({ ...draft, baseUrl: e.target.value })} required placeholder="https://api.openai.com/v1"/></label>
        <div className="provider-chips">{providers.map(p => <button type="button" key={p.name} className={draft.baseUrl === p.url ? 'selected' : ''} onClick={() => setDraft({ ...draft, baseUrl: p.url, model: '' })}>{p.name}</button>)}</div>
        <label>模型名称<input value={draft.model || ''} onChange={e => setDraft({ ...draft, model: e.target.value })} required={!serverDefaultUsable} placeholder="填写服务商提供的模型 ID" maxLength={120}/></label>
        <label>API Key <span>{savedKeyUsable ? '已保存，留空保留' : serverDefaultUsable ? '服务端已配置，可留空' : '必填'}</span><input type="password" value={draft.apiKey || ''} onChange={e => setDraft({ ...draft, apiKey: e.target.value })} autoComplete="off" placeholder={savedKeyUsable ? '已保存，留空保留原模型 Key' : serverDefaultUsable ? '留空以使用服务端密钥' : '输入你的 API Key'} required={!serverKeyUsable} maxLength={512}/></label>
        <div className="settings-divider"/>
        <label>搜索接口 <span>Tavily Key · {stored?.hasTavilyKey ? '已保存' : config?.searchConfigured ? '选填' : '必填'}</span><input type="password" value={draft.tavilyKey || ''} onChange={e => setDraft({ ...draft, tavilyKey: e.target.value })} autoComplete="off" placeholder={stored?.hasTavilyKey ? '已保存，留空保留原搜索 Key' : config?.searchConfigured ? '留空则尝试默认搜索' : 'tvly-…'} required={!config?.searchConfigured && !stored?.hasTavilyKey} maxLength={512}/></label>
        <p className="field-help">{config?.searchConfigured ? '默认搜索在云端可能被限流，建议填写 Tavily 专用搜索 Key。' : '使用 Tavily 搜索产品资料，或在服务端配置 SearXNG。'} <a href="https://app.tavily.com" target="_blank" rel="noopener noreferrer">获取 Key <ArrowUpRight size={11}/></a></p>
        <button type="button" className="search-test-button" onClick={testSearch} disabled={searchTesting || saving}>{searchTesting ? <LoaderCircle size={13} className="spin"/> : <Search size={13}/>} {searchTesting ? '正在测试联网搜索…' : '测试联网搜索'}</button>
        {searchTest && <p className={`search-test-result ${searchTest.ok ? 'success' : 'failure'}`} role="status">{searchTest.text}</p>}
        {storageMessage && <p className="storage-message" role="status">{storageMessage}</p>}
        <button type="submit" className="save-button" disabled={saving || searchTesting}>{saving ? <><LoaderCircle size={17} className="spin"/>处理中…</> : <>保存设置 <Check size={17}/></>}</button>
        <button type="button" className="forget-settings" onClick={forgetSettings} disabled={saving || searchTesting}>清除已保存配置</button>
      </form>
    </dialog>
    <dialog ref={methodDialog} className="modal methodology" onClick={e => { if (e.target === e.currentTarget) methodDialog.current?.close(); }}><div className="modal-heading"><h2>我们怎么判断？</h2><button className="icon-button" aria-label="关闭判断说明" onClick={() => methodDialog.current?.close()}><X size={20}/></button></div><p>先检索产品名称、功效、价格和独立评测，再由 AI 比对公开信息。配置 Laya 后，它会作为额外的辅助信号参与分析。</p><ol><li><strong>功效有没有证据</strong><span>区分宣传说法、用户感受与独立研究，核对材料是否对应具体产品。</span></li><li><strong>价格是否匹配价值</strong><span>关注核心卖点与替代品；价格高和品牌溢价本身不意味着智商税。</span></li><li><strong>对什么人有用</strong><span>需求、使用场景和审美偏好，也属于真实价值。</span></li></ol><p className="method-note">百分比是 AI 对风险的主观估计，未经真实购买数据校准。证据不足时不显示分数；它不能替代检测报告、医疗建议或你自己的选择。</p></dialog>
  </div>;
}
