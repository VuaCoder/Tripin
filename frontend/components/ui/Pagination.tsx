'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';

export interface PaginationProps {
  currentPage?: number;
  page?: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
  itemLabel?: string;
  showInfo?: boolean;
}

export function Pagination({
  currentPage: propCurrentPage,
  page,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  disabled = false,
  className,
  itemLabel = 'kết quả',
  showInfo = false,
}: PaginationProps) {
  const currentPage = propCurrentPage ?? page ?? 1;
  // If there is only 1 page or 0 pages, do not render pagination
  if (totalPages <= 1) {
    return null;
  }

  const startItem = totalItems !== undefined ? Math.min((currentPage - 1) * pageSize + 1, totalItems) : null;
  const endItem = totalItems !== undefined ? Math.min(currentPage * pageSize, totalItems) : null;

  // Generate page numbers with smart ellipsis
  const getPages = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis-start');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) pages.push('ellipsis-end');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <nav
      aria-label="Phân trang"
      className={cn(
        'flex flex-col sm:flex-row items-center gap-4 py-4 px-2 select-none',
        showInfo ? 'justify-between' : 'justify-center sm:justify-end',
        className
      )}
    >
      {/* Item or page count info */}
      {showInfo && (
        <div className="text-xs sm:text-sm text-slate-500 order-2 sm:order-1 font-medium">
          {totalItems !== undefined && startItem && endItem ? (
            <span>
              Hiển thị <span className="font-semibold text-slate-800">{startItem}</span> -{' '}
              <span className="font-semibold text-slate-800">{endItem}</span> trong{' '}
              <span className="font-semibold text-slate-800">{totalItems}</span> {itemLabel}
            </span>
          ) : (
            <span>
              Trang <span className="font-semibold text-slate-800">{currentPage}</span> /{' '}
              <span className="font-semibold text-slate-800">{totalPages}</span>
            </span>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="inline-flex items-center gap-1.5 order-1 sm:order-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || disabled}
          aria-label="Trang trước"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span>Trước</span>
        </button>

        {/* Page pills */}
        <div className="flex items-center gap-1">
          {getPages().map((pageItem, index) => {
            if (typeof pageItem === 'string') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="size-9 flex items-center justify-center text-xs text-slate-400 font-bold"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            const isActive = pageItem === currentPage;
            return (
              <button
                key={pageItem}
                type="button"
                onClick={() => onPageChange(pageItem)}
                disabled={disabled || isActive}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Trang ${pageItem}`}
                className={cn(
                  'size-9 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center transition-all',
                  isActive
                    ? 'bg-teal-600 text-white font-bold shadow-xs shadow-teal-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-60'
                )}
              >
                {pageItem}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || disabled}
          aria-label="Trang sau"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <span>Sau</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
