'use client';

import { useEffect, useState } from 'react';

interface AvatarPreviewProps {
  url?: string | null;
  name: string;
  size?: 'md' | 'lg';
}

export function AvatarPreview({ url, name, size = 'lg' }: AvatarPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = name
    ? name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    : 'U';
  const sizeClass = size === 'lg' ? 'h-24 w-24 text-2xl' : 'h-16 w-16 text-lg';

  useEffect(() => setImageFailed(false), [url]);

  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-primary-container font-extrabold text-on-primary shadow-[0_10px_28px_rgba(0,99,110,0.18)] ${sizeClass}`}>
      {url && !imageFailed ? (
        // The API accepts arbitrary HTTPS avatar hosts, so next/image cannot safely preconfigure every domain.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Ảnh đại diện của ${name}`}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-label={`Ảnh đại diện mặc định của ${name}`}>{initials}</span>
      )}
    </div>
  );
}
