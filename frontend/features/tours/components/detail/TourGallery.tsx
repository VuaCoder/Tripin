'use client';
/* eslint-disable @next/next/no-img-element */
import { useRef } from 'react';
import { Images, ImageOff, X } from 'lucide-react';
import styles from './tour-detail.module.css';
export function TourGallery({ images, title }: { images: string[]; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const photos = Array.from(new Set(images.filter(Boolean)));
  if (!photos.length) return <div className={styles.noPhotos}><ImageOff size={32} /><span>Hình ảnh tour đang được cập nhật</span></div>;
  return <>
    <div className={`${styles.gallery} ${photos.length === 1 ? styles.singlePhoto : ''} ${photos.length === 2 ? styles.twoPhotos : ''}`}>
      {photos.slice(0, 3).map((src, index) => <button type="button" key={src} className={styles.photo} onClick={() => dialog.current?.showModal()} aria-label={`Xem ảnh ${index + 1} của ${title}`}><img src={src} alt={`${title} — ảnh ${index + 1}`} loading={index ? 'lazy' : 'eager'} /></button>)}
      <button type="button" className={styles.allPhotos} onClick={() => dialog.current?.showModal()}><Images size={17} /> Xem tất cả {photos.length} ảnh</button>
    </div>
    <dialog ref={dialog} className={styles.galleryDialog} aria-label={`Hình ảnh ${title}`} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className={styles.dialogHeader}><h2>{title}</h2><button type="button" onClick={() => dialog.current?.close()} aria-label="Đóng thư viện ảnh"><X size={24} /></button></div>
      <div className={styles.photoCollection}>{photos.map((src, index) => <img key={src} src={src} alt={`${title} — ảnh ${index + 1}`} loading="lazy" />)}</div>
    </dialog>
  </>;
}
