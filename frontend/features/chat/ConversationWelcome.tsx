import Link from 'next/link';
import { ArrowRight, Compass, Send } from 'lucide-react';
import styles from './conversation-welcome.module.css';

export function ConversationWelcome({ guide, recent }: { guide: boolean; recent?: { id: string; name: string } }) {
  return <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center sm:px-10">
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.orbit} />
      <svg className={styles.route} viewBox="0 0 280 210" fill="none"><path d="M32 148C-2 89 65 24 147 31s135 66 96 128c-24 39-74 40-103 22" stroke="#9bc8c7" strokeWidth="1.5" strokeDasharray="4 7" /></svg>
      <div className={styles.first}><span className={styles.avatar}><Compass size={21} /></span><div><span className={styles.line} /><span className={styles.shortLine} /></div></div>
      <div className={styles.reply}><span /><span /><span /></div>
      <span className={styles.plane}><Send size={26} strokeWidth={1.6} /></span>
    </div>
    <h2 className="max-w-sm [text-wrap:balance] text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl">{recent ? 'Tiếp nối câu chuyện, sẵn sàng lên đường' : guide ? 'Chờ một lời chào, đón hành trình mới' : 'Một lời chào, mở ra một hành trình'}</h2>
    <p className="mt-3 max-w-sm [text-wrap:pretty] text-sm leading-7 text-slate-600">{recent ? 'Lịch trình, điểm hẹn hay những điều bạn muốn biết — mọi trao đổi cho chuyến đi đều ở đây.' : guide ? 'Khi du khách liên hệ từ tour bạn phụ trách, cuộc trò chuyện sẽ xuất hiện tại đây để bạn tư vấn và đồng hành cùng họ.' : 'Bạn muốn hỏi về lịch trình hay điểm hẹn? Khám phá tour và nhắn tin trực tiếp cho hướng dẫn viên từ trang chi tiết tour.'}</p>
    {recent ? <Link href={`/conversations/${recent.id}`} className="mt-6 inline-flex max-w-full items-center gap-2 rounded-xl bg-primary-container px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal"><span className="truncate">Trò chuyện với {recent.name}</span><ArrowRight size={17} className="shrink-0" /></Link> : !guide && <Link href="/tours" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-container px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal">Khám phá tour<ArrowRight size={17} /></Link>}
  </div>;
}
