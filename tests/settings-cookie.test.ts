import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { SETTINGS_COOKIE, SETTINGS_MAX_AGE, encryptSettings, decryptSettings, readSettings, cookieHeader, settingsMetadata, mergeSettings } from '../lib/settings-cookie.ts';
const secret = Buffer.alloc(32, 7).toString('base64url');
const settings = { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash', apiKey: 'test-model-secret', tavilyKey: 'test-search-secret' };

test('settings persist in authenticated ciphertext without plaintext keys', async () => {
  const encrypted = await encryptSettings(settings, secret, 1000);
  assert.ok(!encrypted.includes(settings.apiKey) && !encrypted.includes(settings.tavilyKey));
  assert.deepEqual(await decryptSettings(encrypted, secret, 2000), settings);
  assert.notEqual(await encryptSettings(settings, secret, 1000), encrypted);
});
test('tampering, key rotation, invalid cookies and expiration never restore credentials', async () => {
  const encrypted = await encryptSettings(settings, secret, 1000);
  const [iv, cipher] = encrypted.split('.');
  const changed = cipher[0] === 'A' ? 'B' : 'A';
  assert.equal(await decryptSettings(`${iv}.${changed}${cipher.slice(1)}`, secret, 2000), undefined);
  assert.equal(await decryptSettings(encrypted, Buffer.alloc(32, 9).toString('base64url'), 2000), undefined);
  assert.equal(await decryptSettings(encrypted, secret, 1000 + SETTINGS_MAX_AGE * 1000), undefined);
  assert.equal(await decryptSettings('not-a-cookie', secret), undefined);
  assert.equal(await decryptSettings(encrypted, undefined), undefined);
});
test('cookie metadata exposes presence and provider only, never the saved keys', () => {
  const metadata = settingsMetadata(settings);
  assert.equal(metadata.hasApiKey, true);
  assert.equal(metadata.hasTavilyKey, true);
  assert.equal(metadata.model, 'deepseek-flash');
  assert.ok(!JSON.stringify(metadata).includes(settings.apiKey));
  assert.equal('apiKey' in metadata, false);
  assert.equal('tavilyKey' in metadata, false);
});
test('cookies are scoped to API routes with HttpOnly, strict same-site and HTTPS protection', () => {
  const header = cookieHeader('ciphertext', true);
  assert.ok(header.includes('Path=/api') && header.includes('HttpOnly') && header.includes('SameSite=Strict') && header.includes('; Secure'));
  assert.ok(header.includes(`Max-Age=${SETTINGS_MAX_AGE}`));
  assert.ok(!header.includes('Domain='));
  assert.ok(cookieHeader('', true, true).includes('Max-Age=0'));
  assert.ok(!cookieHeader('ciphertext', false).includes('; Secure'));
});
test('a subsequent request restores credentials from its own cookie and no other visitor state', async () => {
  const encrypted = await encryptSettings(settings, secret);
  const env = { SETTINGS_COOKIE_SECRET: secret };
  const request = new Request('https://app.example/api/analyze', { headers: { Cookie: `other=unrelated; ${SETTINGS_COOKIE}=${encrypted}` } });
  assert.deepEqual(await readSettings(request, env), settings);
  assert.equal(await readSettings(new Request('https://app.example/api/analyze'), env), undefined);
});
test('saved keys are bound to their provider, can be replaced, and never leak to another URL', () => {
  const restored = mergeSettings({ baseUrl: settings.baseUrl, model: settings.model }, settings, {});
  assert.equal(restored.apiKey, settings.apiKey);
  assert.equal(restored.tavilyKey, settings.tavilyKey);
  const changed = mergeSettings({ baseUrl: 'https://api.openai.com/v1', model: 'other-model' }, settings, {});
  assert.equal(changed.apiKey, undefined);
  assert.equal(changed.tavilyKey, settings.tavilyKey);
  assert.equal(mergeSettings({ apiKey: 'replacement' }, settings, {}).apiKey, 'replacement');
});
test('missing encryption configuration and oversized browser settings are rejected', async () => {
  await assert.rejects(encryptSettings(settings, undefined), /尚未配置/);
  await assert.rejects(encryptSettings({ ...settings, apiKey: 'x'.repeat(513) }, secret), /过长/);
});
