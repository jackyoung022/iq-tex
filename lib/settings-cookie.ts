import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { AppError, type Env, type Settings } from './analysis.ts';

export const SETTINGS_COOKIE = 'iq_tax_settings_v1';
export const SETTINGS_MAX_AGE = 30 * 24 * 60 * 60;
const fields = z.object({
  baseUrl: z.string().trim().max(300).optional(), model: z.string().trim().max(120).optional(),
  apiKey: z.string().trim().max(512).optional(), tavilyKey: z.string().trim().max(512).optional(),
});
const envelope = z.object({ version: z.literal(1), expiresAt: z.number().int(), settings: fields });
const aad = new TextEncoder().encode(SETTINGS_COOKIE);
const base = (value: string) => value.replace(/\/+$/, '');

async function encryptionKey(secret?: string) {
  if (!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret)) throw new AppError('COOKIE_CONFIG', '浏览器配置保存服务尚未配置，请联系应用管理员。', 503);
  const bytes = Uint8Array.from(Buffer.from(secret, 'base64url'));
  if (bytes.length !== 32) throw new AppError('COOKIE_CONFIG', '浏览器配置保存服务尚未配置，请联系应用管理员。', 503);
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSettings(settings: Settings, secret?: string, now = Date.now()) {
  const checked = fields.safeParse(settings);
  if (!checked.success) throw new AppError('CONFIG_INVALID', '配置内容格式不正确或过长。', 400);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify({ version: 1, expiresAt: now + SETTINGS_MAX_AGE * 1000, settings: checked.data }));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, await encryptionKey(secret), data);
  const value = Buffer.from(iv).toString('base64url') + '.' + Buffer.from(encrypted).toString('base64url');
  if (value.length > 3600) throw new AppError('CONFIG_INVALID', '配置内容过长，无法保存到浏览器 Cookie。', 400);
  return value;
}

export async function decryptSettings(value: string, secret?: string, now = Date.now()): Promise<Settings | undefined> {
  if (!secret || value.length > 3600 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return undefined;
  try {
    const [ivPart, encryptedPart] = value.split('.');
    const iv = Uint8Array.from(Buffer.from(ivPart, 'base64url'));
    if (iv.length !== 12) return undefined;
    const encrypted = Uint8Array.from(Buffer.from(encryptedPart, 'base64url'));
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad }, await encryptionKey(secret), encrypted);
    const checked = envelope.safeParse(JSON.parse(new TextDecoder().decode(data)));
    if (!checked.success || checked.data.expiresAt <= now) return undefined;
    return checked.data.settings;
  } catch { return undefined; }
}

export function cookieHeader(value: string, secure: boolean, clear = false) {
  return `${SETTINGS_COOKIE}=${value}; Path=/api; Max-Age=${clear ? 0 : SETTINGS_MAX_AGE}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}
export async function readSettings(request: Request, env: Env): Promise<Settings | undefined> {
  const value = (request.headers.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${SETTINGS_COOKIE}=`))?.slice(SETTINGS_COOKIE.length + 1);
  return value ? decryptSettings(value, env.SETTINGS_COOKIE_SECRET) : undefined;
}
export function settingsMetadata(settings?: Settings) {
  return { baseUrl: settings?.baseUrl || '', model: settings?.model || '', hasApiKey: !!settings?.apiKey, hasTavilyKey: !!settings?.tavilyKey };
}
export function mergeSettings(input: Settings, stored: Settings | undefined, env: Env): Settings {
  const baseUrl = input.baseUrl || stored?.baseUrl || env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const sameBase = !!stored?.baseUrl && base(stored.baseUrl) === base(baseUrl);
  // Never move a saved model key to a different client-selected provider/path.
  return {
    baseUrl, model: input.model || (sameBase ? stored?.model : undefined),
    apiKey: input.apiKey || (sameBase ? stored?.apiKey : undefined),
    tavilyKey: input.tavilyKey || stored?.tavilyKey,
  };
}
