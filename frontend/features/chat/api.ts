import { baseApi } from '@/store/api/baseApi';
import type { Conversation, Message, MessagesPage } from './types';
interface Envelope<T> { data: T }
export const chatApi = baseApi.enhanceEndpoints({ addTagTypes: ['Conversation'] }).injectEndpoints({
  endpoints: build => ({
    conversations: build.query<{ data: Conversation[]; meta: { page: number; totalPages: number } }, number>({
      query: page => ({ url: '/chat/conversations', params: { page, limit: 20 } }), providesTags: ['Conversation'],
    }),
    conversation: build.query<Conversation, string>({
      query: id => `/chat/conversations/${encodeURIComponent(id)}`,
      transformResponse: (result: Envelope<Conversation>) => result.data, providesTags: ['Conversation'],
    }),
    startConversation: build.mutation<Conversation, { participantId: string; tourId?: string }>({
      query: body => ({ url: '/chat/conversations', method: 'POST', body }),
      transformResponse: (result: Envelope<Conversation>) => result.data, invalidatesTags: ['Conversation'],
    }),
    messages: build.query<MessagesPage, { id: string; before?: string }>({
      query: ({ id, before }) => ({ url: `/chat/conversations/${encodeURIComponent(id)}/messages`, params: { limit: 30, before } }),
      transformResponse: (result: Envelope<MessagesPage>) => result.data,
    }),
    sendMessage: build.mutation<Message, { id: string; text: string }>({
      query: ({ id, text }) => ({ url: `/chat/conversations/${encodeURIComponent(id)}/messages`, method: 'POST', body: { text } }),
      transformResponse: (result: Envelope<Message>) => result.data, invalidatesTags: ['Conversation'],
    }),
    readConversation: build.mutation<unknown, string>({
      query: id => ({ url: `/chat/conversations/${encodeURIComponent(id)}/read`, method: 'POST' }),
      invalidatesTags: ['Conversation'],
    }),
  }),
});
export const { useConversationsQuery, useConversationQuery, useStartConversationMutation, useSendMessageMutation, useReadConversationMutation } = chatApi;
