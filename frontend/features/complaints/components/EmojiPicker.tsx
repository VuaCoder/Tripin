'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Biểu cảm',
    icon: '😃',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😋', '😜', '🤪',
      '😎', '🥳', '😏', '🥺', '😢', '😭', '😤', '😠', '😡', '🤯',
      '😳', '😱', '😨', '🤔', '🤫', '😶', '😐', '😑', '😬', '🙄',
      '😴', '😷', '🤒', '🤕', '🥱', '🤐', '🤢', '🤮',
    ],
  },
  {
    id: 'gestures',
    name: 'Cử chỉ',
    icon: '👍',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🫰', '🤟', '🤘', '👏', '🙌',
      '🤝', '🤛', '🤜', '👊', '✊', '👋', '🤙', '💪', '🙏', '✍️',
      '🙋‍♂️', '🙋‍♀️', '🙇‍♂️', '🙇‍♀️', '🤌', '🤏', '👉', '👈',
    ],
  },
  {
    id: 'symbols',
    name: 'Trái tim & Ký hiệu',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💯', '✨', '🌟',
      '⭐', '🔥', '💥', '⚠️', 'ℹ️', '✅', '❌', '❓', '❗', '💡',
      '📌', '📍', '🕒', '⏳', '🎯', '🎉', '🎁', '🔔',
    ],
  },
  {
    id: 'travel',
    name: 'Du lịch & Dịch vụ',
    icon: '✈️',
    emojis: [
      '✈️', '🚗', '🚌', '🚕', '🧳', '🏖️', '🏝️', '🏕️', '🏨', '🛎️',
      '🎫', '📸', '🗺️', '🏔️', '🚢', '🚆', '⛺', '🧭', '🍽️', '☕',
      '🍹', '🌴', '☀️', '⛅', '🌧️', '⛈️', '🌈', '⛰️', '🏞️', '🎒',
    ],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeTab, setActiveTab] = useState<string>('smileys');
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const currentCategory = EMOJI_CATEGORIES.find((c) => c.id === activeTab) || EMOJI_CATEGORIES[0]!;

  const filteredEmojis = search.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((emoji) => emoji.includes(search.trim()))
    : currentCategory.emojis;

  return (
    <div
      ref={containerRef}
      className="flex w-72 sm:w-80 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <span className="text-xs font-bold text-slate-700">Biểu tượng cảm xúc (Emoji)</span>
        <button
          type="button"
          onClick={onClose}
          className="size-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          aria-label="Đóng bảng emoji"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative my-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm emoji..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 outline-none transition focus:border-brand-teal focus:bg-white focus:ring-1 focus:ring-brand-teal"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Category Tabs */}
      {!search.trim() && (
        <div className="flex items-center justify-between gap-1 pb-2 border-b border-slate-100">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveTab(cat.id)}
              title={cat.name}
              className={`flex-1 flex items-center justify-center py-1 rounded-lg text-sm transition ${
                activeTab === cat.id
                  ? 'bg-teal-50 border border-teal-200 shadow-2xs'
                  : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <span className="select-none">{cat.icon}</span>
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="grid grid-cols-7 sm:grid-cols-8 gap-1 max-h-48 overflow-y-auto p-1 py-2">
        {filteredEmojis.length > 0 ? (
          filteredEmojis.map((emoji, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onSelect(emoji)}
              className="flex size-8 items-center justify-center rounded-lg text-lg select-none transition hover:bg-slate-100 hover:scale-125 focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
              title={emoji}
            >
              {emoji}
            </button>
          ))
        ) : (
          <div className="col-span-full py-6 text-center text-xs text-slate-400">
            Không tìm thấy emoji nào phù hợp.
          </div>
        )}
      </div>

      {/* Quick category label */}
      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-medium px-1 flex items-center justify-between">
        <span>{search.trim() ? `Kết quả tìm kiếm (${filteredEmojis.length})` : currentCategory.name}</span>
        <span className="text-[10px] text-slate-400">Nhấn để chèn</span>
      </div>
    </div>
  );
}
