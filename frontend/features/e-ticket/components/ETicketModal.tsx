'use client';

import React, { useEffect } from 'react';
import type { ETicketDto } from '../types';
import { ETicketCard } from './ETicketCard';

export interface ETicketModalProps {
  open: boolean;
  ticket: ETicketDto | null;
  onClose: () => void;
}

export function ETicketModal({ open, ticket, onClose }: ETicketModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-3xl my-8 animate-scaleIn">
        <ETicketCard ticket={ticket} onClose={onClose} showBackToBooking={false} />
      </div>
    </div>
  );
}
