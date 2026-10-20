'use client';

import { useState, useRef, useEffect, useMemo, type ChangeEvent, type KeyboardEvent } from 'react';
import { MapPin, Search, Check, X, Globe } from 'lucide-react';
import { 
  VIETNAM_PROVINCES, 
  POPULAR_PROVINCES, 
  normalizeSearchText, 
  searchVietnamProvinces,
  type ProvinceData 
} from '../constants/vietnamProvinces';

interface Props {
  id: string;
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  required?: boolean;
  hint?: React.ReactNode;
}

export function TourDestinationCombobox({
  id,
  value,
  onChange,
  onBlur,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
  required,
  hint,
}: Props) {
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

  // Ranked matching provinces based on smart relevance scoring
  const matchingProvinces = useMemo(() => {
    return searchVietnamProvinces(value || '');
  }, [value]);

  // Check if current value already matches a standard province exactly
  const hasExactProvinceMatch = useMemo(() => {
    const query = normalizeSearchText(value || '');
    if (!query) return false;
    return VIETNAM_PROVINCES.some((p) => !p.isOther && normalizeSearchText(p.name) === query);
  }, [value]);

  // Popular provinces when input is empty
  const popularProvinceList = useMemo(() => {
    return POPULAR_PROVINCES
      .filter((p) => p !== 'Khác')
      .map((name) => VIETNAM_PROVINCES.find((p) => p.name === name))
      .filter((p): p is ProvinceData => Boolean(p));
  }, []);

  const handleSelect = (destinationName: string) => {
    onChange(destinationName);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    const showCustomOption = value.trim() && !hasExactProvinceMatch;
    const itemsCount = value.trim() 
      ? matchingProvinces.length + (showCustomOption ? 1 : 0) 
      : popularProvinceList.length + 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1 < itemsCount ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : itemsCount - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) {
        if (value.trim()) {
          if (activeIndex < matchingProvinces.length) {
            handleSelect(matchingProvinces[activeIndex].name);
          } else if (showCustomOption) {
            handleSelect(value.trim());
          }
        } else {
          if (activeIndex < popularProvinceList.length) {
            handleSelect(popularProvinceList[activeIndex].name);
          } else {
            handleSelect('Khác');
          }
        }
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const clearSelection = () => {
    onChange('');
    setIsOpen(true);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const showCustomOption = value.trim() && !hasExactProvinceMatch;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Bar */}
      <div className="relative">
        <div className="pointer-events-none absolute top-3 left-3.5 text-slate-400">
          <Search size={18} className={value ? 'text-[#087e8b]' : 'text-slate-400'} />
        </div>

        <input
          ref={inputRef}
          id={id}
          name="destination"
          type="text"
          required={required}
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedby}
          placeholder="Nhập để tìm tỉnh thành (vd: Hà Giang, Sa Pa, Hạ Long, Đà Nẵng...)"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#087e8b] focus:ring-2 focus:ring-[#087e8b]/20 placeholder:text-slate-400"
        />

        {value && (
          <div className="absolute top-2.5 right-2.5 flex items-center">
            <button
              type="button"
              onClick={clearSelection}
              aria-label="Xoá điểm đến"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {hint}
      </div>

      {/* Autocomplete Popup Suggestions (Clean 1-column single-line layout) */}
      {isOpen && (
        <div 
          ref={listRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150 divide-y divide-slate-100"
        >
          {/* Case 1: When user types text */}
          {value.trim() ? (
            <>
              {matchingProvinces.length > 0 && (
                <div className="p-1 space-y-0.5">
                  {matchingProvinces.map((province, idx) => {
                    const isSelected = value.toLowerCase() === province.name.toLowerCase();
                    const isKeyboardActive = activeIndex === idx;
                    return (
                      <button
                        key={province.name}
                        type="button"
                        onClick={() => handleSelect(province.name)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                          isKeyboardActive
                            ? 'bg-teal-50 text-teal-900'
                            : isSelected
                            ? 'bg-teal-50/80 text-teal-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <MapPin size={16} className={isSelected ? 'text-[#087e8b]' : 'text-slate-400'} />
                          <span className="text-sm font-semibold truncate text-slate-900">
                            {province.name}
                          </span>
                        </div>

                        {isSelected && (
                          <Check size={16} className="text-[#087e8b] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Show Custom Option only when typed text is NOT an exact match of a province */}
              {showCustomOption && (
                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => handleSelect(value.trim())}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left hover:bg-slate-50 transition-colors cursor-pointer text-slate-800"
                  >
                    <Globe size={16} className="text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold truncate">
                      Điểm đến khác: &quot;{value.trim()}&quot;
                    </span>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Case 2: When input is empty, show clean single-column popular list */
            <div className="p-1 space-y-0.5">
              {popularProvinceList.map((province, idx) => {
                const isSelected = value.toLowerCase() === province.name.toLowerCase();
                const isKeyboardActive = activeIndex === idx;
                return (
                  <button
                    key={province.name}
                    type="button"
                    onClick={() => handleSelect(province.name)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      isKeyboardActive
                        ? 'bg-teal-50 text-teal-900'
                        : isSelected
                        ? 'bg-teal-50/80 text-teal-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MapPin size={16} className={isSelected ? 'text-[#087e8b]' : 'text-slate-400'} />
                      <span className="text-sm font-semibold truncate text-slate-900">
                        {province.name}
                      </span>
                    </div>

                    {isSelected && (
                      <Check size={16} className="text-[#087e8b] shrink-0" />
                    )}
                  </button>
                );
              })}

              {/* Clean Option for "Khác" */}
              <button
                type="button"
                onClick={() => handleSelect('Khác')}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left hover:bg-slate-50 transition-colors cursor-pointer text-slate-700"
              >
                <Globe size={16} className="text-slate-400 shrink-0" />
                <span className="text-sm font-semibold">Điểm đến khác</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
