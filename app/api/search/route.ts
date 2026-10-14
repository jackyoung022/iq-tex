import { AppError, searchProduct } from '@/lib/analysis';
import { z } from 'zod';
const schema = z.object({ product: z.string().trim().min(2).max(120), tavilyKey: z.string().trim().max(512).optional() });
const pending = new Map<string, number>();
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: '请从应用页面发起请求。' }, { status: 403, headers });
  try {
    const text = await request.text();
    if (text.length > 1500) throw new AppError('INPUT_INVALID', '输入内容过长。', 413);
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new AppError('INPUT_INVALID', '请求格式不正确。', 400); }
    const checked = schema.safeParse(parsed);
    if (!checked.success) throw new AppError('INPUT_INVALID', '请输入 2–120 个字符的产品名称。', 400);
    const visitor = request.headers.get('oai-authenticated-user-id') || request.headers.get('cf-connecting-ip') || 'local';
    const now = Date.now();
    for (const [key, started] of pending) if (now - started > 60000) pending.delete(key);
    if (pending.has(visitor)) throw new AppError('BUSY', '搜索测试正在进行，请稍后重试。', 429);
    pending.set(visitor, now);
    try {
      const result = await searchProduct(checked.data.product, { tavilyKey: checked.data.tavilyKey }, process.env);
      return Response.json({ provider: result.provider, count: result.sources.length, sources: result.sources.map(({ content: _content, ...source }) => source), warnings: result.warnings }, { headers });
    } finally { pending.delete(visitor); }
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.message, code: e.code }, { status: e.status, headers });
    return Response.json({ error: '联网搜索暂时失败，请稍后重试。', code: 'SEARCH_UNAVAILABLE' }, { status: 502, headers });
  }
}
