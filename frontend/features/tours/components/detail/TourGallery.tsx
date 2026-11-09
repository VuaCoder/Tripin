'use client';
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Images, ImageOff, X } from 'lucide-react';
import styles from './tour-detail.module.css';
export function TourGallery({ images, title }: { images: string[]; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(0);
  const photos = Array.from(new Set(images.filter(Boolean)));
  if (!photos.length) return <div className={styles.noPhotos}><ImageOff size={32} /><span>Hình ảnh tour đang được cập nhật</span></div>;
  const open = (index: number) => {
    setActive(index);
    dialog.current?.showModal();
  };
  const step = (delta: number) => setActive((current) => (current + delta + photos.length) % photos.length);
  return <>
    <div className={`${styles.gallery} ${photos.length === 1 ? styles.singlePhoto : ''} ${photos.length === 2 ? styles.twoPhotos : ''}`}>
      {photos.slice(0, 3).map((src, index) => <button type="button" key={src} className={styles.photo} onClick={() => open(index)} aria-label={`Xem ảnh ${index + 1} của ${title}`}><img src={src} alt={`${title} — ảnh ${index + 1}`} loading={index ? 'lazy' : 'eager'} /></button>)}
      {photos.length > 1 && <button type="button" className={styles.allPhotos} onClick={() => open(0)}><Images size={17} /> Xem tất cả {photos.length} ảnh</button>}
    </div>
    <dialog ref={dialog} className={styles.galleryDialog} aria-label={`Hình ảnh ${title}`} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className={styles.lightbox}>
        <div className={styles.lightboxHeader}>
          <span className={styles.lightboxCounter}>{active + 1}/{photos.length}</span>
          <button type="button" className={styles.lightboxClose} onClick={() => dialog.current?.close()} aria-label="Đóng thư viện ảnh"><X size={24} /></button>
        </div>
        {photos.length > 1 && <button type="button" className={`${styles.lightboxNav} ${styles.lightboxPrev}`} onClick={() => step(-1)} aria-label="Ảnh trước"><ChevronLeft size={26} /></button>}
        <div className={styles.lightboxStage}>
          <img className={styles.lightboxImage} src={photos[active]} alt={`${title} — ảnh ${active + 1}`} />
        </div>
        {photos.length > 1 && <button type="button" className={`${styles.lightboxNav} ${styles.lightboxNext}`} onClick={() => step(1)} aria-label="Ảnh sau"><ChevronRight size={26} /></button>}
        {photos.length > 1 && (
          <div className={styles.lightboxThumbs}>
            {photos.map((src, index) => <button type="button" key={src} className={index === active ? styles.lightboxThumbActive : styles.lightboxThumb} onClick={() => setActive(index)} aria-label={`Chuyển tới ảnh ${index + 1}`} aria-current={index === active}><img src={src} alt="" /></button>)}
          </div>
        )}
      </div>
    </dialog>
  </>;
}
