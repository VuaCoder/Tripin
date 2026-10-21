'use client';

import { useState, useRef, useEffect, useMemo, type ChangeEvent, type KeyboardEvent } from 'react';
import { Search, Check, X, Plus } from 'lucide-react';
import { normalizeSearchText } from '../constants/vietnamProvinces';

interface Props {
  id?: string;
  label: string;
  optional?: boolean;
  placeholder?: string;
  items: string[];
  onChange: (items: string[]) => void;
  suggestions: string[];
  tone?: 'positive' | 'neutral';
}

export function TourItemCombobox({
  id,
  label,
  optional = true,
  placeholder = 'Ví dụ: Xe đưa đón, vé tham quan...',
  items,
  onChange,
  suggestions,
  tone = 'positive',
}: Props) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter matching suggestions
  const matchingSuggestions = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return suggestions;
    }
    const normQ = normalizeSearchText(trimmed);
    return suggestions.filter((item) => normalizeSearchText(item).includes(normQ));
  }, [suggestions, query]);

  // Exact match check
  const exactMatch = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    const normQ = normalizeSearchText(trimmed);
    return suggestions.find((s) => normalizeSearchText(s) === normQ);
  }, [suggestions, query]);

  const showCustomAddOption = query.trim().length > 0 && !exactMatch;

  const toggleItem = (itemText: string) => {
    const trimmed = itemText.trim();
    if (!trimmed) return;

    if (items.includes(trimmed)) {
      onChange(items.filter((item) => item !== trimmed));
    } else {
      onChange([...items, trimmed]);
    }
    setQuery('');
    setActiveIndex(-1);
  };

  const handleAddCustom = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (!items.includes(trimmed)) {
      onChange([...items, trimmed]);
    }
    setQuery('');
    setActiveIndex(-1);
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const totalOptions = matchingSuggestions.length + (showCustomAddOption ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => (prev < totalOptions - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : totalOptions - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) {
        if (activeIndex < matchingSuggestions.length) {
          toggleItem(matchingSuggestions[activeIndex]);
        } else if (showCustomAddOption) {
          handleAddCustom();
        }
      } else if (showCustomAddOption) {
        handleAddCustom();
      } else if (matchingSuggestions.length > 0) {
        toggleItem(matchingSuggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const isPositive = tone === 'positive';
  const brandColor = isPositive ? '#087e8b' : '#334155';

  return (
    <div ref={containerRef} className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-bold text-slate-800 block">
          {label}
        </label>
        {items.length > 0 && (
          <span className="text-xs text-slate-400">
            Đã chọn {items.length} mục
          </span>
        )}
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <div className="pointer-events-none absolute top-3 left-3.5 text-slate-400">
          <Search size={18} className={query ? (isPositive ? 'text-[#087e8b]' : 'text-slate-700') : 'text-slate-400'} />
        </div>

        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-2.5 pr-10 pl-10 text-sm font-medium text-slate-900 transition-all placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-[#087e8b] focus:outline-none focus:ring-4 focus:ring-[#087e8b]/10"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute top-2.5 right-3 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
            title="Xóa tìm kiếm"
          >
            <X size={16} />
          </button>
        )}

        {/* Dropdown Popup */}
        {isOpen && (
          <div
            ref={listRef}
            className="absolute z-50 mt-1.5 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {/* Custom Item Addition Option */}
            {showCustomAddOption && (
              <button
                type="button"
                onClick={handleAddCustom}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition cursor-pointer mb-1 border border-dashed ${
                  isPositive
                    ? 'border-[#087e8b]/40 bg-[#087e8b]/5 text-[#087e8b] hover:bg-[#087e8b]/10'
                    : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Plus size={16} className={isPositive ? 'text-[#087e8b] shrink-0' : 'text-slate-700 shrink-0'} />
                <div className="flex-1 truncate">
                  <span>Thêm: </span>
                  <span className="font-bold underline">"{query.trim()}"</span>
                </div>
                <span className="text-[11px] font-normal text-slate-500 shrink-0">Nhấn Enter</span>
              </button>
            )}

            {/* List Matching Suggestions */}
            {matchingSuggestions.length > 0 ? (
              <div className="space-y-0.5">
                {matchingSuggestions.map((item, idx) => {
                  const isSelected = items.includes(item);
                  const isFocused = idx === activeIndex;

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleItem(item)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition cursor-pointer ${
                        isSelected
                          ? isPositive
                            ? 'bg-[#087e8b]/10 text-[#087e8b] font-semibold'
                            : 'bg-slate-200/70 text-slate-900 font-semibold'
                          : isFocused
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{item}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSelected ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${isPositive ? 'text-[#087e8b]' : 'text-slate-700'}`}>
                            <Check size={14} />
                            Đã chọn
                          </span>
                        ) : (
                          <Plus size={14} className="text-slate-400" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : !showCustomAddOption ? (
              <div className="px-3 py-6 text-center text-sm text-slate-500">
                Không tìm thấy mục nào phù hợp với &ldquo;{query}&rdquo;
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Selected Items as removable chips */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {items.map((item, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-xs transition-all ${
                isPositive
                  ? 'bg-teal-50 border border-teal-200 text-teal-800'
                  : 'bg-slate-100 border border-slate-200 text-slate-700'
              }`}
            >
              {isPositive ? (
                <Check size={12} className="text-teal-700 shrink-0" />
              ) : (
                <X size={12} className="text-slate-500 shrink-0" />
              )}
              <span>{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="rounded-full hover:bg-black/10 p-0.5 cursor-pointer transition text-slate-500 hover:text-rose-600"
                title={`Xóa ${item}`}
                aria-label={`Xóa ${item}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
