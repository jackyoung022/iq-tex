import { analyze, AppError, type Settings } from '@/lib/analysis';
import { z } from 'zod';
const schema = z.object({ product: z.string().trim().min(2).max(120), settings: z.object({ baseUrl: z.string().max(300).optional(), model: z.string().max(120).optional(), apiKey: z.string().max(512).optional(), tavilyKey: z.string().max(512).optional() }).optional() });
const active = new Map<string, number>();
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: '请从应用页面发起请求。' }, { status: 403 });
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const text = await request.text();
    if (text.length > 6000) throw new AppError('INPUT_INVALID', '输入内容过长。', 413);
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new AppError('INPUT_INVALID', '请求格式不正确。', 400); }
    const data = schema.safeParse(parsed);
    if (!data.success) throw new AppError('INPUT_INVALID', '请输入 2–120 个字符的产品名称。', 400);
    const visitor = request.headers.get('oai-authenticated-user-id') || request.headers.get('cf-connecting-ip') || 'local';
    const now = Date.now();
    for (const [key, started] of active) if (now - started > 150000) active.delete(key);
    if (active.has(visitor)) throw new AppError('BUSY', '已有判断正在进行，请稍后重试。', 429);
    active.set(visitor, now);
    try {
      return Response.json(await analyze(data.data.product, (data.data.settings || {}) as Settings, process.env), { headers });
    } finally { active.delete(visitor); }
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.message, code: e.code }, { status: e.status, headers });
    return Response.json({ error: '判断暂时失败，请稍后重试。', code: 'INTERNAL_ERROR' }, { status: 500, headers });
  }
}
