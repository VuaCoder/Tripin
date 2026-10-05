interface AvatarPreviewProps {
  url?: string | null;
  name: string;
}

export function AvatarPreview({ url, name }: AvatarPreviewProps) {
  const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
  
  if (url) {
    return (
      <div className="relative w-20 h-20 rounded-full overflow-hidden bg-surface-dim border border-brand-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="object-cover w-full h-full" onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement?.classList.add('fallback-active');
        }} />
        <div className="absolute inset-0 flex items-center justify-center bg-surface-dim text-brand-slate text-xl font-bold hidden [div.fallback-active_&]:flex">
          {initials}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-20 h-20 rounded-full bg-brand-primary text-white text-xl font-bold border border-brand-border shrink-0">
      {initials}
    </div>
  );
}
