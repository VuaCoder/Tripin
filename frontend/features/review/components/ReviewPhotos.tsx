'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import styles from './review-photos.module.css';

/** A compact guest-photo strip; the native dialog provides focus trapping and Escape support. */
export function ReviewPhotos({ images = [], author = 'du khách' }: { images?: string[]; author?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(0);
  if (!images.length) return null;
  const move = (offset: number) => setActive(index => (index + offset + images.length) % images.length);
  const open = (index: number) => { setActive(index); dialog.current?.showModal(); };
  return <>
    <div className={styles.strip} aria-label={`Ảnh chuyến đi của ${author}`}>
      {images.slice(0, 4).map((image, index) => <button key={`${image}-${index}`} type="button" className={styles.thumb} onClick={() => open(index)} aria-label={`Xem ảnh ${index + 1} trong ${images.length} ảnh của ${author}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={`Ảnh chuyến đi ${index + 1} của ${author}`} loading="lazy" />
        {index === 3 && images.length > 4 && <span className={styles.more}>+{images.length - 4}</span>}
      </button>)}
    </div>
    <dialog ref={dialog} className={styles.viewer} aria-label={`Ảnh đánh giá của ${author}`} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }} onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
    }}>
      <div className={styles.viewerHeader}><div><h3>Khoảnh khắc từ chuyến đi</h3><p aria-live="polite">{author} · Ảnh {active + 1} / {images.length}</p></div><button type="button" onClick={() => dialog.current?.close()} aria-label="Đóng ảnh đánh giá"><X size={22} /></button></div>
      <div className={styles.stage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[active]} alt={`Ảnh chuyến đi ${active + 1} của ${author}`} />
        {images.length > 1 && <><button type="button" className={styles.previous} onClick={() => move(-1)} aria-label="Ảnh trước"><ChevronLeft /></button><button type="button" className={styles.next} onClick={() => move(1)} aria-label="Ảnh tiếp theo"><ChevronRight /></button></>}
      </div>
      <div className={styles.filmstrip}>{images.map((image, index) => <button type="button" key={`${image}-${index}`} aria-label={`Chọn ảnh ${index + 1}`} aria-pressed={active === index} onClick={() => setActive(index)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" loading="lazy" />
      </button>)}</div>
    </dialog>
  </>;
}
