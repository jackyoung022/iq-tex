import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, cleanSources, resolveLLM, searchProduct, validateJudgment } from '../lib/analysis.ts';
const env = { OPENAI_API_KEY: 'server-secret', OPENAI_MODEL: 'test-model', SEARXNG_URL: 'https://search.example/search' };
const rows = [{ title: '产品官方资料', url: 'https://brand.example/product', content: '产品宣称有效，但未给出独立实验。' }, { title: '产品独立评测', url: 'https://review.example/test', content: '评测没有发现该宣传效果。' }];
const sources = cleanSources(rows);
const valid = { product: '测试产品', evidence: 'sufficient', probability: 78, summary: '宣传功效缺少独立支持。', reasons: [{ title: '证据有限', detail: '两份材料无法支撑核心卖点。', sourceIds: [1, 2] }], advice: '优先考虑有检测报告的替代品。', uncertainty: '缺少实际价格。' };
const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('server secret cannot be forwarded to another allowed provider', () => {
  assert.throws(() => resolveLLM({ baseUrl: 'https://api.deepseek.com/v1', model: 'model' }, env), /API Key/);
  assert.equal(resolveLLM({ baseUrl: 'https://api.deepseek.com/v1', apiKey: 'visitor-secret', model: 'model' }, env).apiKey, 'visitor-secret');
});
test('unapproved client URLs, credentials and insecure endpoints are rejected', () => {
  for (const baseUrl of ['http://127.0.0.1/v1', 'https://internal.example/v1', 'https://api.openai.com:8080/v1', 'https://user:pass@api.openai.com/v1', 'https://api.openai.com/v1?other=1']) assert.throws(() => resolveLLM({ baseUrl, apiKey: 'key', model: 'model' }, env));
});
test('missing model or key never starts network requests', async () => {
  let calls = 0;
  await assert.rejects(analyze('测试产品', {}, {}, async () => { calls++; return ok({}); }), /API Key/);
  assert.equal(calls, 0);
});
test('search results discard unsafe links and deduplicate fragment URLs', () => {
  const cleaned = cleanSources([...rows, { ...rows[0], url: rows[0].url + '#track' }, { ...rows[0], url: 'javascript:alert(1)' }, { ...rows[0], url: 'https://user:pass@example.com' }, { ...rows[0], url: 'https://empty.example', content: '' }]);
  assert.equal(cleaned.length, 2);
});
test('fabricated citations and out-of-range model scores are rejected', () => {
  assert.throws(() => validateJudgment({ ...valid, reasons: [{ ...valid.reasons[0], sourceIds: [99] }] }, sources), /来源/);
  assert.throws(() => validateJudgment({ ...valid, probability: 120 }, sources), /格式/);
  assert.throws(() => validateJudgment({ ...valid, probability: '78' }, sources), /格式/);
});
test('insufficient evidence and single-domain citations cannot produce a score', () => {
  assert.equal(validateJudgment({ ...valid, evidence: 'insufficient' }, sources).probability, null);
  assert.equal(validateJudgment({ ...valid, reasons: [{ ...valid.reasons[0], sourceIds: [1] }] }, sources).probability, null);
  assert.equal(validateJudgment({ ...valid, reasons: [{ ...valid.reasons[0], sourceIds: [] }] }, sources).probability, null);
});
test('partial search failure still provides sources with a warning', async () => {
  let count = 0;
  const searched = await searchProduct('测试产品', {}, env, async () => ++count === 1 ? ok({ results: rows }) : new Response('', { status: 500 }));
  assert.equal(searched.sources.length, 2);
  assert.equal(searched.warnings.length, 1);
});
test('zero search results abstain without requesting a model', async () => {
  let calls = 0;
  const result = await analyze('测试产品', {}, env, async url => { assert.match(String(url), /search/); calls++; return ok({ results: [] }); });
  assert.equal(calls, 2);
  assert.equal(result.probability, null);
  assert.equal(result.verdict, '暂无法判断');
});
test('search credentials are not leaked into the model payload', async () => {
  const result = await analyze('测试产品', { apiKey: 'visitor-key', tavilyKey: 'search-secret' }, env, async (url, init) => {
    if (String(url).includes('tavily')) { assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer search-secret'); return ok({ results: rows }); }
    const payload = String(init?.body);
    assert.ok(!payload.includes('search-secret') && !payload.includes('visitor-key') && !payload.includes('server-secret'));
    return ok({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(valid) } }] });
  });
  assert.equal(result.probability, 78);
  assert.equal(result.product, '测试产品');
  assert.equal(result.laya.status, 'disabled');
});
test('truncated output and auth failure return readable errors without secret details', async () => {
  await assert.rejects(analyze('测试产品', {}, env, async url => String(url).includes('/search') ? ok({ results: rows }) : ok({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(valid) } }] })), /未完成/);
  await assert.rejects(analyze('测试产品', {}, env, async url => String(url).includes('/search') ? ok({ results: rows }) : new Response('secret-debug-content', { status: 401 })), e => e instanceof Error && /API Key/.test(e.message) && !e.message.includes('secret-debug-content'));
});
test('Laya failure preserves the LLM analysis and discloses fallback', async () => {
  const result = await analyze('测试产品', {}, { ...env, LAYA_BASE_URL: 'https://laya.example' }, async url => {
    if (String(url).includes('/search')) return ok({ results: rows });
    if (String(url).includes('/systemone')) return new Response('', { status: 503 });
    return ok({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(valid) } }] });
  });
  assert.equal(result.probability, 78);
  assert.equal(result.laya.status, 'unavailable');
  assert.equal(result.warnings.length, 1);
});
test('Laya uses verified multilingual wire contract and stays auxiliary', async () => {
  const result = await analyze('测试产品', {}, { ...env, LAYA_BASE_URL: 'https://laya.example' }, async (url, init) => {
    if (String(url).includes('/search')) return ok({ results: rows });
    if (String(url).includes('/systemone')) {
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.model, 'multilingual'); assert.equal(payload.max_len, 8192); assert.equal(payload.questions.overpriced.type, 'noul');
      return ok({ answers: { overpriced: { type: 'noul', noul: 0.91 } } });
    }
    assert.equal(JSON.parse(String(init?.body)).messages.length, 2);
    return ok({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(valid) } }] });
  });
  assert.equal(result.laya.probability, 91);
  assert.equal(result.probability, 78);
});
test('redirects are stopped before sending credentials to another origin', async () => {
  await assert.rejects(analyze('测试产品', {}, env, async (url, init) => {
    assert.equal(init?.redirect, 'manual');
    if (String(url).includes('/search')) return ok({ results: rows });
    return new Response('', { status: 302, headers: { Location: 'https://untrusted.example' } });
  }), /302/);
});
