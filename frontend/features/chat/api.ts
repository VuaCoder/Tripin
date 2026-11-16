import { baseApi } from '@/store/api/baseApi';
import type { Conversation, Message, MessagesPage } from './types';
interface Envelope<T> { data: T }
/** Agency threads live under `/agency/chat` so the base query attaches X-Agency-Id and the API scopes by tenant. */
const root = (agency?: boolean) => (agency ? '/agency/chat' : '/chat');
export const chatApi = baseApi.enhanceEndpoints({ addTagTypes: ['Conversation'] }).injectEndpoints({
  endpoints: build => ({
    conversations: build.query<{ data: Conversation[]; meta: { page: number; totalPages: number } }, { page: number; agency?: boolean }>({
      // Loads every conversation in one go: pages of up to the backend's max page size (100) are
      // fetched and merged so the inbox shows the complete set instead of forcing the user to paginate.
      queryFn: async ({ agency }, _api, _extra, baseQuery) => {
        const root = agency ? '/agency/chat' : '/chat';
        const limit = 100;
        const all: Conversation[] = [];
        let currentPage = 1;
        let totalPages = 1;
        for (;;) {
          const result = await baseQuery({ url: `${root}/conversations`, params: { page: currentPage, limit } });
          if (result.error) return { error: result.error };
          const body = result.data as { data?: Conversation[]; meta?: { page?: number; totalPages?: number } };
          const items: Conversation[] = body?.data ?? [];
          all.push(...items);
          totalPages = body?.meta?.totalPages ?? 1;
          if (currentPage >= totalPages || items.length < limit) break;
          currentPage += 1;
        }
        return { data: { data: all, meta: { page: 1, totalPages: 1 } } };
      },
      providesTags: ['Conversation'],
    }),
    conversation: build.query<Conversation, { id: string; agency?: boolean }>({
      query: ({ id, agency }) => `${root(agency)}/conversations/${encodeURIComponent(id)}`,
      transformResponse: (result: Envelope<Conversation>) => result.data, providesTags: ['Conversation'],
    }),
    startConversation: build.mutation<Conversation, { participantId?: string; agencyId?: string; tourId?: string; agency?: boolean }>({
      query: ({ agency, ...body }) => ({ url: `${root(agency)}/conversations`, method: 'POST', body }),
      transformResponse: (result: Envelope<Conversation>) => result.data, invalidatesTags: ['Conversation'],
    }),
    messages: build.query<MessagesPage, { id: string; before?: string; agency?: boolean }>({
      query: ({ id, before, agency }) => ({ url: `${root(agency)}/conversations/${encodeURIComponent(id)}/messages`, params: { limit: 30, before } }),
      transformResponse: (result: Envelope<MessagesPage>) => result.data,
    }),
    sendMessage: build.mutation<Message, { id: string; text: string; agency?: boolean }>({
      query: ({ id, text, agency }) => ({ url: `${root(agency)}/conversations/${encodeURIComponent(id)}/messages`, method: 'POST', body: { text } }),
      transformResponse: (result: Envelope<Message>) => result.data, invalidatesTags: ['Conversation'],
    }),
    readConversation: build.mutation<unknown, { id: string; agency?: boolean }>({
      query: ({ id, agency }) => ({ url: `${root(agency)}/conversations/${encodeURIComponent(id)}/read`, method: 'POST' }),
      invalidatesTags: ['Conversation'],
    }),
  }),
});
export const { useConversationsQuery, useConversationQuery, useStartConversationMutation, useSendMessageMutation, useReadConversationMutation } = chatApi;
