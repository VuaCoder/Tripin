import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../utils/app-error';
import { AiService } from '../ai.service';
import { AI_LIMITS, AI_SYSTEM_PROMPT } from '../ai.types';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { DisabledAiProvider } from '../providers/disabled.provider';

type M = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function make(opts: { enabled?: boolean; seed?: M[]; reply?: string } = {}) {
  const db = [...(opts.seed ?? [])];
  const repo = {
    create: vi.fn(async (userId: string, title: string, messages: M[]) => {
      const doc = { id: `ai${db.length + 1}`, userId, title, messages: messages.map((m) => ({ ...m, createdAt: new Date() })), messageCount: messages.length, updatedAt: new Date() };
      db.push(doc);
      return doc;
    }),
    findOwned: vi.fn(async (id: string, userId: string) => db.find((c) => c.id === id && c.userId === userId) ?? null),
    appendMessages: vi.fn(async (id: string, userId: string, messages: M[]) => {
      const doc = db.find((c) => c.id === id && c.userId === userId);
      if (!doc || doc.messageCount + messages.length > AI_LIMITS.MAX_MESSAGES_PER_CONVERSATION) return null;
      doc.messages.push(...messages.map((m) => ({ ...m, createdAt: new Date() })));
      doc.messageCount += messages.length;
      return doc;
    }),
    listByUser: vi.fn(async () => ({ items: db, total: db.length })),
  };
  const provider = {
    name: 'fake',
    enabled: opts.enabled ?? true,
    generate: vi.fn(async (_input: M) => ({ text: opts.reply ?? 'Try Ha Long Bay in spring.' })),
  };
  return { service: new AiService(repo as never, provider as never), repo, provider, db };
}

describe('chat', () => {
  it('starts a conversation, sends the fixed system prompt and stores the successful exchange only', async () => {
    const { service, provider, repo } = make();
    const result = await service.chat('u1', { message: 'Where should I go in March?' });
    const sent = provider.generate.mock.calls[0]![0];
    expect(sent.system).toBe(AI_SYSTEM_PROMPT);
    expect(sent.messages).toEqual([{ role: 'user', content: 'Where should I go in March?' }]);
    expect(sent.maxTokens).toBe(AI_LIMITS.MAX_OUTPUT_TOKENS);
    expect(repo.create).toHaveBeenCalledWith('u1', 'Where should I go in March?', [
      { role: 'user', content: 'Where should I go in March?' },
      { role: 'assistant', content: 'Try Ha Long Bay in spring.' },
    ]);
    expect(result).toMatchObject({ conversationId: 'ai1', messageCount: 2, reply: { role: 'assistant', content: 'Try Ha Long Bay in spring.' } });
  });

  it('continues an existing conversation with only the most recent context', async () => {
    const history = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
    const { service, provider } = make({ seed: [{ id: 'ai1', userId: 'u1', title: 't', messages: history, messageCount: 30, updatedAt: new Date() }] });
    await service.chat('u1', { conversationId: 'ai1', message: 'and in April?' });
    const messages = provider.generate.mock.calls[0]![0].messages;
    expect(messages).toHaveLength(AI_LIMITS.CONTEXT_MESSAGES + 1);
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'and in April?' });
    expect(messages[0]).toEqual({ role: 'user', content: 'm10' });
  });

  it('does not store anything when the provider fails', async () => {
    const { service, provider, repo } = make();
    provider.generate.mockRejectedValueOnce(AppError.unavailable('down'));
    await expect(service.chat('u1', { message: 'hello' })).rejects.toMatchObject({ statusCode: 503 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('answers 503 and sends nothing when the AI is disabled', async () => {
    const { service, provider } = make({ enabled: false });
    await expect(service.chat('u1', { message: 'hello' })).rejects.toMatchObject({ statusCode: 503 });
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it('never lets one user continue or read another user\'s conversation', async () => {
    const seed = [{ id: 'ai1', userId: 'u1', title: 't', messages: [], messageCount: 0, updatedAt: new Date() }];
    const { service, provider } = make({ seed });
    await expect(service.chat('u2', { conversationId: 'ai1', message: 'hi' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getMine('u2', 'ai1')).rejects.toMatchObject({ statusCode: 404 });
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it('refuses a full conversation before calling the model, and also when a concurrent request filled it', async () => {
    const full = { id: 'ai1', userId: 'u1', title: 't', messages: [], messageCount: AI_LIMITS.MAX_MESSAGES_PER_CONVERSATION, updatedAt: new Date() };
    const a = make({ seed: [full] });
    await expect(a.service.chat('u1', { conversationId: 'ai1', message: 'more' })).rejects.toMatchObject({ code: 'AI_CONVERSATION_FULL' });
    expect(a.provider.generate).not.toHaveBeenCalled();

    const b = make({ seed: [{ ...full, messageCount: 2 }] });
    b.repo.appendMessages.mockResolvedValueOnce(null as never);
    await expect(b.service.chat('u1', { conversationId: 'ai1', message: 'more' })).rejects.toMatchObject({ code: 'AI_CONVERSATION_FULL' });
  });

  it('caps the stored reply length', async () => {
    const { service, db } = make({ reply: 'x'.repeat(AI_LIMITS.MAX_STORED_REPLY_LENGTH + 500) });
    await service.chat('u1', { message: 'long please' });
    expect(db[0]!.messages[1].content).toHaveLength(AI_LIMITS.MAX_STORED_REPLY_LENGTH);
  });

  it('lists summaries and returns a full transcript to its owner', async () => {
    const { service } = make();
    await service.chat('u1', { message: 'hello there' });
    expect((await service.listMine('u1', { page: 1, limit: 20 })).items[0]).toMatchObject({ title: 'hello there', messageCount: 2 });
    expect((await service.getMine('u1', 'ai1')).messages).toHaveLength(2);
  });
});

describe('providers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('the disabled provider refuses every call', async () => {
    const provider = new DisabledAiProvider();
    expect(provider.enabled).toBe(false);
    await expect(provider.generate({ system: 's', messages: [], maxTokens: 1 })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('Anthropic: sends the documented request and joins the text blocks', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'Hello ' }, { type: 'tool_use' }, { type: 'text', text: 'world' }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new AnthropicProvider({ apiKey: 'secret-key', model: 'model-x' });
    expect(provider.enabled).toBe(true);
    expect(await provider.generate({ system: 'sys', messages: [{ role: 'user', content: 'hi' }], maxTokens: 50 })).toEqual({ text: 'Hello world' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('secret-key');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    expect(JSON.parse(init.body)).toEqual({ model: 'model-x', max_tokens: 50, system: 'sys', messages: [{ role: 'user', content: 'hi' }] });
  });

  it('Anthropic: failures become a generic 503 that never leaks vendor details', async () => {
    const provider = new AnthropicProvider({ apiKey: 'k', model: 'm' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 529, json: async () => ({ error: { type: 'overloaded_error', message: 'secret internals' } }) })));
    const error = await provider.generate({ system: 's', messages: [], maxTokens: 1 }).catch((e) => e);
    expect(error).toMatchObject({ statusCode: 503 });
    expect(JSON.stringify(error.message)).not.toContain('secret internals');

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('ECONNRESET'))));
    await expect(provider.generate({ system: 's', messages: [], maxTokens: 1 })).rejects.toMatchObject({ statusCode: 503 });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ content: [] }) })));
    await expect(provider.generate({ system: 's', messages: [], maxTokens: 1 })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('Anthropic without key/model is disabled', async () => {
    const provider = new AnthropicProvider(undefined);
    expect(provider.enabled).toBe(false);
    await expect(provider.generate({ system: 's', messages: [], maxTokens: 1 })).rejects.toMatchObject({ statusCode: 503 });
  });
});
