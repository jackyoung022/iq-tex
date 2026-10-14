import { getHistoryDb } from '@/db';
import { listPublicSearches, parseHistoryQuery } from '@/lib/search-history';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  let options;
  try { options = parseHistoryQuery(new URL(request.url)); }
  catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '筛选参数无效。' }, { status: 400, headers });
  }
  const db = getHistoryDb();
  if (!db) return Response.json({ error: '搜索记录服务尚未配置。' }, { status: 503, headers });
  try { return Response.json(await listPublicSearches(db, options), { headers }); }
  catch { return Response.json({ error: '暂时无法读取搜索记录，请稍后重试。' }, { status: 503, headers }); }
}
