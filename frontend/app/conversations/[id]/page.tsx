import { ConversationPage } from '@/features/chat/ConversationPage';
export default function Page({ params }: { params: { id: string } }) { return <ConversationPage id={params.id} />; }
