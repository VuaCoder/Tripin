import { baseApi } from '@/store/api/baseApi';
import type {
  AiApiResponse,
  AiChatInput,
  AiChatResult,
  AiConversationDetail,
  AiConversationSummary,
} from '../ai-types';

export const aiChatApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    chatWithAi: build.mutation<AiChatResult, AiChatInput>({
      query: (body) => ({
        url: '/ai/chat',
        method: 'POST',
        body,
      }),
      transformResponse: (response: AiApiResponse<AiChatResult>) => response.data,
      async onQueryStarted(input, { dispatch, queryFulfilled }) {
        // Preview the outgoing text while the model is working, without creating
        // a persistent conversation or increasing the incoming unread counter.
        const updatedAt = new Date().toISOString();
        const patch = dispatch(aiChatApi.util.updateQueryData('getAiOverview', undefined, draft => {
          const previous = draft.latest?.id === input.conversationId ? draft.latest : null;
          draft.latest = {
            id: input.conversationId ?? '', title: previous?.title ?? input.message.slice(0, 60),
            messageCount: previous?.messageCount ?? 0, unreadCount: previous?.unreadCount ?? 0, updatedAt,
            lastMessage: { role: 'user', content: input.message, createdAt: updatedAt, status: 'sending' },
          };
        }));
        try { await queryFulfilled; }
        catch { patch.undo(); }
      },
      invalidatesTags: [{ type: 'AiChat', id: 'LIST' }],
    }),

    getAiOverview: build.query<{ latest: AiConversationSummary | null; unreadCount: number }, void>({
      query: () => '/ai/overview',
      transformResponse: (response: AiApiResponse<{ latest: AiConversationSummary | null; unreadCount: number }>) => response.data,
      providesTags: [{ type: 'AiChat', id: 'LIST' }],
    }),

    readAiConversation: build.mutation<{ unreadCount: number }, { id: string; throughMessageId: string }>({
      query: ({ id, throughMessageId }) => ({ url: `/ai/conversations/${encodeURIComponent(id)}/read`, method: 'POST', body: { throughMessageId } }),
      transformResponse: (response: AiApiResponse<{ unreadCount: number }>) => response.data,
      invalidatesTags: [{ type: 'AiChat', id: 'LIST' }],
    }),

    getAiConversations: build.query<
      { data: AiConversationSummary[]; meta: { page: number; totalPages: number; total: number } },
      { page?: number; limit?: number } | void
    >({
      query: (params) => ({
        url: '/ai/conversations',
        params: { page: params?.page ?? 1, limit: params?.limit ?? 20 },
      }),
      transformResponse: (response: AiApiResponse<AiConversationSummary[]>) => ({
        data: response.data,
        meta: response.meta ?? {
          page: 1,
          totalPages: 1,
          total: response.data.length,
          limit: 20,
        },
      }),
      providesTags: [{ type: 'AiChat', id: 'LIST' }],
    }),

    getAiConversation: build.query<AiConversationDetail, string>({
      query: (id) => `/ai/conversations/${encodeURIComponent(id)}`,
      transformResponse: (response: AiApiResponse<AiConversationDetail>) => response.data,
      providesTags: (_res, _err, id) => [{ type: 'AiChat', id }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useChatWithAiMutation,
  useGetAiConversationsQuery,
  useGetAiConversationQuery,
  useLazyGetAiConversationQuery,
  useGetAiOverviewQuery,
  useReadAiConversationMutation,
} = aiChatApi;
