'use client';

import { useState, useRef, useEffect, useMemo, type ChangeEvent, type KeyboardEvent } from 'react';
import { Search, Check, X, Plus, Loader2, Tag } from 'lucide-react';
import type { TourCategory } from '../types';
import { formatCategoryName } from '../utils';
import { normalizeSearchText } from '../constants/vietnamProvinces';
import { useCreateAgencyCategoryMutation } from '../api/toursApi';

interface Props {
  id?: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  categories: TourCategory[];
  isLoading?: boolean;
  maxSelection?: number;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
}


export function TourCategoryCombobox({
  id = 'tour-categories',
  selectedIds,
  onChange,
  categories,
  isLoading = false,
  maxSelection = 10,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
  'aria-labelledby': ariaLabelledby,
}: Props) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [createCategory, { isLoading: isCreating }] = useCreateAgencyCategoryMutation();
  const [createError, setCreateError] = useState<string | null>(null);

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

  // Map for fast ID lookup
  const categoryById = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Selected Category objects
  const selectedCategories = useMemo(() => {
    return selectedIds.map((id) => categoryById.get(id)).filter((c): c is TourCategory => Boolean(c));
  }, [selectedIds, categoryById]);

  // Filtered matching categories based on user query
  const matchingCategories = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return categories;
    }
    const normQ = normalizeSearchText(trimmed);
    return categories.filter((cat) => {
      const normName = normalizeSearchText(cat.name);
      const normVnName = normalizeSearchText(formatCategoryName(cat.name));
      return normName.includes(normQ) || normVnName.includes(normQ);
    });
  }, [categories, query]);

  // Check if current query matches an existing category exactly (either English or Vietnamese name)
  const exactMatch = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    const normQ = normalizeSearchText(trimmed);
    return categories.find(
      (c) => normalizeSearchText(c.name) === normQ || normalizeSearchText(formatCategoryName(c.name)) === normQ,
    );
  }, [categories, query]);


  const toggleCategory = (categoryId: string) => {
    if (selectedIds.includes(categoryId)) {
      onChange(selectedIds.filter((id) => id !== categoryId));
    } else {
      if (selectedIds.length >= maxSelection) {
        return;
      }
      onChange([...selectedIds, categoryId]);
    }
    setQuery('');
    setActiveIndex(-1);
  };

  const handleCreateCustomCategory = async () => {
    const name = query.trim();
    if (!name || isCreating) return;

    if (exactMatch) {
      toggleCategory(exactMatch.id);
      return;
    }

    if (selectedIds.length >= maxSelection) {
      setCreateError(`Bạn đã chọn tối đa ${maxSelection} danh mục.`);
      return;
    }

    setCreateError(null);
    try {
      const newCategory = await createCategory({ name }).unwrap();
      if (newCategory?.id) {
        if (!selectedIds.includes(newCategory.id)) {
          onChange([...selectedIds, newCategory.id]);
        }
        setQuery('');
        setIsOpen(false);
        setActiveIndex(-1);
      }
    } catch {
      setCreateError('Không thể tạo danh mục lúc này. Vui lòng thử lại.');
    }
  };

  const showCustomAddOption = query.trim().length >= 2 && !exactMatch;

  // Keyboard navigation inside combobox
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    const itemsCount = matchingCategories.length + (showCustomAddOption ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1 < itemsCount ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : itemsCount - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) {
        if (activeIndex < matchingCategories.length) {
          toggleCategory(matchingCategories[activeIndex].id);
        } else if (showCustomAddOption) {
          void handleCreateCustomCategory();
        }
      } else if (showCustomAddOption) {
        void handleCreateCustomCategory();
      } else if (matchingCategories.length > 0) {
        toggleCategory(matchingCategories[0].id);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div
      ref={containerRef}
      role="group"
      aria-labelledby={ariaLabelledby}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedby}
      className="space-y-3"
    >
      {/* Search Input Bar */}
      <div className="relative">
        <div className="pointer-events-none absolute top-3 left-3.5 text-slate-400">
          <Search size={18} className={query ? 'text-[#087e8b]' : 'text-slate-400'} />
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
            setCreateError(null);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedby}
          aria-labelledby={ariaLabelledby}
          placeholder="Tìm hoặc nhập danh mục tour (vd: Nghỉ dưỡng, Săn mây, Du thuyền, Gia đình...)"
          autoComplete="off"
          className={`w-full rounded-2xl border bg-slate-50/50 py-2.5 pr-10 pl-10 text-sm font-medium text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-4 ${
            ariaInvalid
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
              : 'border-slate-200 focus:border-[#087e8b] focus:ring-[#087e8b]/10'
          }`}
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute top-2.5 right-3 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
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
            {/* Custom Category Creation Option */}
            {showCustomAddOption && (
              <button
                type="button"
                onClick={() => void handleCreateCustomCategory()}
                disabled={isCreating}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition cursor-pointer mb-1 border border-dashed border-[#087e8b]/40 ${
                  activeIndex === matchingCategories.length
                    ? 'bg-[#087e8b]/15 text-[#087e8b]'
                    : 'bg-[#087e8b]/5 text-[#087e8b] hover:bg-[#087e8b]/10'
                }`}
              >
                {isCreating ? (
                  <Loader2 size={16} className="animate-spin shrink-0 text-[#087e8b]" />
                ) : (
                  <Plus size={16} className="shrink-0 text-[#087e8b]" />
                )}
                <div className="flex-1 truncate">
                  <span>Thêm danh mục mới: </span>
                  <span className="font-bold underline decoration-[#087e8b]/50">"{query.trim()}"</span>
                </div>
                <span className="text-[11px] font-normal text-slate-500 shrink-0">Nhập tay</span>
              </button>
            )}

            {createError && (
              <div className="px-3 py-2 text-xs text-red-600 font-medium bg-red-50 rounded-xl mb-1">
                {createError}
              </div>
            )}

            {/* List Matching Categories */}
            {matchingCategories.length > 0 ? (
              <div className="space-y-0.5">
                {matchingCategories.map((cat, idx) => {
                  const isSelected = selectedIds.includes(cat.id);
                  const isFocused = idx === activeIndex;
                  const vnName = formatCategoryName(cat.name);
                  const showOriginal = vnName.toLowerCase() !== cat.name.toLowerCase();

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#087e8b]/10 text-[#087e8b] font-semibold'
                          : isFocused
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Tag size={15} className={isSelected ? 'text-[#087e8b]' : 'text-slate-400'} />
                        <span className="truncate">{vnName}</span>
                        {showOriginal && (
                          <span className="text-xs text-slate-400 truncate hidden sm:inline">
                            ({cat.name})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#087e8b]">
                            <Check size={14} />
                            Đã chọn
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : !showCustomAddOption ? (
              <div className="px-3 py-6 text-center text-sm text-slate-500">
                Không tìm thấy danh mục nào phù hợp với &ldquo;{query}&rdquo;
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Selected Categories as removable chips */}
      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Check size={13} className="text-[#087e8b]" />
            Đã chọn ({selectedCategories.length}/{maxSelection}):
          </span>
          {selectedCategories.map((cat) => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#087e8b] px-3 py-1 text-xs font-semibold text-white shadow-xs animate-in fade-in zoom-in-95 duration-100"
            >
              <span>{formatCategoryName(cat.name)}</span>
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className="rounded-full hover:bg-white/20 p-0.5 cursor-pointer transition"
                title={`Bỏ chọn ${formatCategoryName(cat.name)}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {selectedIds.length >= maxSelection && (
            <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full ml-1">
              Đã đạt tối đa {maxSelection} danh mục
            </span>
          )}
        </div>
      )}
    </div>
  );
}
