import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { listPublicSearches, parseHistoryQuery, recordPublicSearch } from '../lib/search-history.ts';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  const migrations = new URL('../drizzle/', import.meta.url);
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(name, migrations), 'utf8'));
  }
  // Execute the production SQL against SQLite, with D1's prepared-statement shape.
  function prepare(sql: string, values: (string | number | null)[] = []) {
    return {
      bind(...next: (string | number | null)[]) { return prepare(sql, next); },
      async run() { sqlite.prepare(sql).run(...values); return { success: true, results: [] }; },
      async all() { return { success: true, results: sqlite.prepare(sql).all(...values) }; },
    };
  }
  const db = { prepare, async batch(statements: ReturnType<typeof prepare>[]) {
    sqlite.exec('BEGIN');
    try { const result = await Promise.all(statements.map(statement => statement.all())); sqlite.exec('COMMIT'); return result; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } } as unknown as D1Database;
  return { db, sqlite };
}
const options = (query = '') => parseHistoryQuery(new URL(`https://app.example/api/history?${new URLSearchParams({ q: query })}`));

test('concurrent repeated names merge atomically, with no customer credential columns', async () => {
  const { db, sqlite } = fixture();
  try {
    await Promise.all(Array.from({ length: 25 }, (_, i) => recordPublicSearch(db, i % 2 ? ' ＤＹＳＯＮ  吹风机 ' : 'Dyson 吹风机', new Date('2026-10-14T10:00:00.000Z'))));
    const data = await listPublicSearches(db, options());
    assert.equal(data.totalProducts, 1);
    assert.equal(data.totalSearches, 25);
    assert.equal(data.items[0].searchCount, 25);
    assert.deepEqual(Object.keys(data.items[0]).sort(), ['firstSearchedAt', 'id', 'lastSearchedAt', 'product', 'searchCount']);
    const columns = sqlite.prepare('PRAGMA table_info(public_searches)').all().map(row => row.name);
    assert.deepEqual(columns, ['id', 'product_key', 'product', 'search_count', 'first_searched_at', 'last_searched_at']);
  } finally { sqlite.close(); }
});

test('keyset pagination returns all products once when timestamps are identical', async () => {
  const { db, sqlite } = fixture();
  try {
    for (let i = 0; i < 45; i++) await recordPublicSearch(db, `测试产品 ${i}`, new Date('2026-10-14T10:00:00.000Z'));
    const ids: number[] = [];
    let cursor: string | null = null;
    do {
      const url = new URL('https://app.example/api/history');
      if (cursor) url.searchParams.set('cursor', cursor);
      const page = await listPublicSearches(db, parseHistoryQuery(url));
      ids.push(...page.items.map(row => row.id));
      cursor = page.nextCursor;
      assert.equal(page.totalProducts, 45);
    } while (cursor);
    assert.equal(ids.length, 45);
    assert.equal(new Set(ids).size, 45);
    assert.deepEqual(ids, Array.from({ length: 45 }, (_, i) => 45 - i));
  } finally { sqlite.close(); }
});

test('literal filtering treats SQL, percent signs and underscores as product text', async () => {
  const { db, sqlite } = fixture();
  try {
    await recordPublicSearch(db, '胶原蛋白肽');
    await recordPublicSearch(db, '测试 100%_配方');
    await recordPublicSearch(db, "产品 ' OR 1=1 --");
    assert.equal((await listPublicSearches(db, options('胶原'))).totalProducts, 1);
    assert.equal((await listPublicSearches(db, options('%_'))).totalProducts, 1);
    assert.equal((await listPublicSearches(db, options("' OR 1=1 --"))).totalProducts, 1);
    const none = await listPublicSearches(db, options('不存在的产品'));
    assert.equal(none.totalSearches, 0);
    assert.equal(none.nextCursor, null);
    assert.equal((await listPublicSearches(db, options())).totalProducts, 3);
  } finally { sqlite.close(); }
});

test('a delayed write never moves the latest timestamp backwards', async () => {
  const { db, sqlite } = fixture();
  try {
    await recordPublicSearch(db, '测试产品', new Date('2026-10-14T12:00:00.000Z'));
    await recordPublicSearch(db, '测试产品', new Date('2026-10-14T11:00:00.000Z'));
    const row = (await listPublicSearches(db, options())).items[0];
    assert.equal(row.searchCount, 2);
    assert.equal(row.lastSearchedAt, '2026-10-14T12:00:00.000Z');
  } finally { sqlite.close(); }
});

test('invalid cursors are rejected, and unavailable storage does not interrupt judgment', async () => {
  assert.throws(() => parseHistoryQuery(new URL('https://app.example/api/history?cursor=invalid')), /分页/);
  assert.throws(() => options('x'.repeat(121)), /120/);
  assert.equal(await recordPublicSearch(undefined, '测试产品'), false);
  const broken = { prepare() { throw new Error('database unavailable'); } } as unknown as D1Database;
  assert.equal(await recordPublicSearch(broken, '测试产品'), false);
});
