import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../../config/env';
import { createAiProvider } from '../providers';
import { GeminiProvider } from '../providers/gemini.provider';

const input = { system: 'Extract facts only', messages: [{ role: 'user' as const, content: 'Tour document' }], maxTokens: 4096 };
const originalConfig = { AI_PROVIDER: env.AI_PROVIDER, AI_API_KEY: env.AI_API_KEY, AI_MODEL: env.AI_MODEL };

describe('Gemini provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(env, originalConfig);
  });

  it('selects Gemini from config and stays disabled when credentials are incomplete', async () => {
    Object.assign(env, { AI_PROVIDER: 'gemini', AI_API_KEY: undefined, AI_MODEL: 'model-test' });
    expect(createAiProvider()).toBeInstanceOf(GeminiProvider);
    expect(createAiProvider().enabled).toBe(false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(createAiProvider().generate(input)).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
    Object.assign(env, { AI_API_KEY: 'test-key' });
    expect(createAiProvider().enabled).toBe(true);
  });

  it('sends document extraction in JSON mode with the key in a header, and excludes thought parts', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{
      finishReason: 'STOP', content: { parts: [
        { text: 'internal reasoning', thought: true }, { text: '{"tours":' }, { text: '[{"title":"Ha Long"}]}' },
      ] },
    }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GeminiProvider({ apiKey: 'test-key', model: 'models/model-test' });
    await expect(provider.generate({ ...input, responseFormat: 'json' })).resolves.toEqual({ text: '{"tours":[{"title":"Ha Long"}]}' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/model-test:generateContent');
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
    expect(JSON.parse(init.body as string)).toEqual({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: 'user', parts: [{ text: 'Tour document' }] }],
      generationConfig: { maxOutputTokens: 4096, responseMimeType: 'application/json' },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps assistant history to model and keeps normal chat in text mode', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Hi' }] } }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    await new GeminiProvider({ apiKey: 'key', model: 'model-test' }).generate({ ...input, messages: [
      { role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi' }, { role: 'user', content: 'Where to?' },
    ] });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const request = JSON.parse(init.body as string);
    expect(request.contents.map((item: { role: string }) => item.role)).toEqual(['user', 'model', 'user']);
    expect(request.generationConfig).not.toHaveProperty('responseMimeType');
  });

  it.each(['MAX_TOKENS', 'SAFETY', undefined])('rejects incomplete or blocked output (%s)', async (finishReason) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason, content: { parts: [{ text: '{"tours":[]}' }] } }] }) })));
    await expect(new GeminiProvider({ apiKey: 'key', model: 'model-test' }).generate(input)).rejects.toMatchObject({ statusCode: 503 });
  });

  it.each([{ candidates: [] }, { candidates: [{ finishReason: 'STOP', content: { parts: [] } }] }, { promptFeedback: { blockReason: 'SAFETY' } }])('rejects empty responses', async (body) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })));
    await expect(new GeminiProvider({ apiKey: 'key', model: 'model-test' }).generate(input)).rejects.toMatchObject({ statusCode: 503 });
  });

  it('maps rate limits and network/JSON failures to 503 without leaking vendor messages', async () => {
    const provider = new GeminiProvider({ apiKey: 'key', model: 'model-test' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'private vendor details' } }) })));
    const error = await provider.generate(input).catch((value: unknown) => value);
    expect(error).toMatchObject({ statusCode: 503 });
    expect(String(error)).not.toContain('private vendor details');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private network details')));
    await expect(provider.generate(input)).rejects.toMatchObject({ statusCode: 503 });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } })));
    await expect(provider.generate(input)).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe('Gemini chat failure diagnostics', () => {
  afterEach(() => vi.unstubAllGlobals());
  const provider = new GeminiProvider({ apiKey: 'secret-key', model: 'test' });
  it('accepts useful truncated chat, but rejects the same result for JSON extraction', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'Useful travel advice' }] } }] }) })));
    await expect(provider.generate({ ...input, allowPartial: true })).resolves.toEqual({ text: 'Useful travel advice', incomplete: true });
    await expect(provider.generate({ ...input, allowPartial: true, responseFormat: 'json' })).rejects.toMatchObject({ code: 'AI_INCOMPLETE_RESPONSE' });
  });
  it.each([[429, 'AI_QUOTA_EXCEEDED'], [403, 'AI_NOT_CONFIGURED'], [503, 'AI_TEMPORARILY_UNAVAILABLE']])('classifies upstream status %s', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status, json: async () => ({ error: { status: 'RESOURCE_EXHAUSTED', message: 'secret' } }) })));
    await expect(provider.generate(input)).rejects.toMatchObject({ statusCode: 503, code });
  });
  it.each([['TimeoutError', 'AI_TIMEOUT'], ['Error', 'AI_UNREACHABLE']])('classifies %s', async (name, code) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('secret'), { name })));
    await expect(provider.generate(input)).rejects.toMatchObject({ code });
  });
  it.each([
    [{ promptFeedback: { blockReason: 'SAFETY' } }, 'AI_CONTENT_BLOCKED'],
    [{ candidates: [{ finishReason: 'STOP', content: { parts: [] } }] }, 'AI_EMPTY_RESPONSE'],
    [{ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] }, 'AI_EMPTY_RESPONSE'],
  ])('classifies blocked or empty chat output', async (body, code) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body })));
    await expect(provider.generate({ ...input, allowPartial: true })).rejects.toMatchObject({ code });
  });
});
