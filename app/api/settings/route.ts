import { AppError, resolveLLM } from '@/lib/analysis';
import { cookieHeader, encryptSettings, mergeSettings, readSettings, settingsMetadata } from '@/lib/settings-cookie';
import { z } from 'zod';
const schema = z.object({ baseUrl: z.string().trim().max(300).optional(), model: z.string().trim().max(120).optional(), apiKey: z.string().trim().max(512).optional(), tavilyKey: z.string().trim().max(512).optional() });
const headers = { 'Cache-Control': 'no-store' };
function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new AppError('ORIGIN_INVALID', '请从应用页面修改配置。', 403);
}
const secure = (request: Request) => new URL(request.url).protocol === 'https:';
export async function GET(request: Request) {
  const stored = await readSettings(request, process.env);
  return Response.json(settingsMetadata(stored), { headers });
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const text = await request.text();
    if (text.length > 6000) throw new AppError('CONFIG_INVALID', '配置内容过长。', 413);
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new AppError('CONFIG_INVALID', '配置格式不正确。', 400); }
    const checked = schema.safeParse(parsed);
    if (!checked.success) throw new AppError('CONFIG_INVALID', '配置格式不正确或过长。', 400);
    const settings = mergeSettings(checked.data, await readSettings(request, process.env), process.env);
    resolveLLM(settings, process.env); // Validate without persisting the server's own default key.
    const value = await encryptSettings(settings, process.env.SETTINGS_COOKIE_SECRET);
    return Response.json(settingsMetadata(settings), { headers: { ...headers, 'Set-Cookie': cookieHeader(value, secure(request)) } });
  } catch (e) {
    return Response.json({ error: e instanceof AppError ? e.message : '配置保存失败，请重试。' }, { status: e instanceof AppError ? e.status : 500, headers });
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    return Response.json(settingsMetadata(), { headers: { ...headers, 'Set-Cookie': cookieHeader('', secure(request), true) } });
  } catch (e) { return Response.json({ error: e instanceof AppError ? e.message : '清除配置失败。' }, { status: e instanceof AppError ? e.status : 500, headers }); }
}
