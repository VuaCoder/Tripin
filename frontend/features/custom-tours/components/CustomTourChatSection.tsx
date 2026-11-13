'use client';

import { useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useListCustomToursQuery } from '../api';
import { CustomTourPinCard } from './CustomTourPinCard';
import { CustomTourPanel } from './CustomTourPanel';

/**
 * The group request pinned under the conversation header. Renders nothing for a conversation that has none,
 * and the `?request=` deep link from notifications picks which request the card shows.
 */
export function CustomTourChatSection({ conversationId, isAgency }: { conversationId: string; isAgency: boolean }) {
  const { data, isError, refetch } = useListCustomToursQuery({ conversationId, limit: 10 });
  const requestedId = useSearchParams()?.get('request') ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);

  const requests = data?.items ?? [];
  const selected = requests.find((request) => request.id === (selectedId ?? requestedId)) ?? requests[0];
  if (isError || !selected) return null;

  const close = () => {
    setOpen(false);
    openButton.current?.focus();
  };

  return (
    <>
      <CustomTourPinCard
        requests={requests}
        selected={selected}
        onSelect={setSelectedId}
        onOpen={() => setOpen(true)}
        openButtonRef={openButton}
      />
      {open && (
        <CustomTourPanel key={selected.id} request={selected} isAgency={isAgency} onClose={close} onRefetch={() => void refetch()} />
      )}
    </>
  );
}
