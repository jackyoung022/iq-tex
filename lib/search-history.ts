import { Buffer } from 'node:buffer';
import { z } from 'zod';

type Database = Pick<D1Database, 'prepare' | 'batch'>;
export type PublicSearch = { id: number; product: string; searchCount: number; firstSearchedAt: string; lastSearchedAt: string };
export type PublicHistory = { items: PublicSearch[]; totalProducts: number; totalSearches: number; nextCursor: string | null };
const cursorSchema = z.object({ at: z.string().datetime(), id: z.number().int().positive().safe() }).strict();
const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim();

export function parseHistoryQuery(url: URL) {
  const query = normalize(url.searchParams.get('q') || '').toLowerCase();
  if (query.length > 120) throw new Error('筛选内容不能超过 120 个字符。');
  const raw = url.searchParams.get('cursor');
  if (!raw) return { query, cursor: undefined };
  try {
    if (raw.length > 300 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error();
    const cursor = cursorSchema.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
    return { query, cursor };
  } catch { throw new Error('分页参数无效，请刷新列表。'); }
}

// A single atomic upsert keeps concurrent searches from overwriting each other.
// The function receives only a product name, never the request or customer keys.
export async function recordPublicSearch(db: Database | undefined, product: string, now = new Date()): Promise<boolean> {
  if (!db) return false;
  const name = normalize(product);
  if (name.length < 2 || name.length > 120) return false;
  try {
    const at = now.toISOString();
    await db.prepare(`INSERT INTO public_searches (product_key, product, first_searched_at, last_searched_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(product_key) DO UPDATE SET
      search_count = public_searches.search_count + 1,
      last_searched_at = MAX(public_searches.last_searched_at, excluded.last_searched_at)`)
      .bind(name.toLowerCase(), name, at, at).run();
    return true;
  } catch { return false; } // History failure must not interrupt a product assessment.
}

export async function listPublicSearches(db: Database, options: ReturnType<typeof parseHistoryQuery>, limit = 20): Promise<PublicHistory> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Invalid page size.');
  const { query, cursor } = options;
  const predicate = `(? = '' OR instr(product_key, ?) > 0)`;
  const page = db.prepare(`SELECT id, product, search_count AS searchCount,
    first_searched_at AS firstSearchedAt, last_searched_at AS lastSearchedAt
    FROM public_searches WHERE ${predicate}
    AND (? IS NULL OR last_searched_at < ? OR (last_searched_at = ? AND id < ?))
    ORDER BY last_searched_at DESC, id DESC LIMIT ?`)
    .bind(query, query, cursor?.at ?? null, cursor?.at ?? null, cursor?.at ?? null, cursor?.id ?? null, limit + 1);
  const totals = db.prepare(`SELECT COUNT(*) AS totalProducts, COALESCE(SUM(search_count), 0) AS totalSearches
    FROM public_searches WHERE ${predicate}`).bind(query, query);
  const [rows, counts] = await db.batch([page, totals]);
  const items = (rows.results as unknown as PublicSearch[]).slice(0, limit);
  const last = items.at(-1);
  const nextCursor = rows.results.length > limit && last
    ? Buffer.from(JSON.stringify({ at: last.lastSearchedAt, id: last.id })).toString('base64url') : null;
  const count = counts.results[0] as { totalProducts: number; totalSearches: number };
  return { items, totalProducts: count.totalProducts, totalSearches: count.totalSearches, nextCursor };
}
