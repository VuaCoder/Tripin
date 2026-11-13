'use client';

import styles from './access-check-loader.module.css';

export function AccessCheckLoader() {
  return (
    <main className={styles.screen} role="status" aria-label="Đang kiểm tra quyền truy cập">
      <div className={styles.scene} aria-hidden="true">
        <div className={styles.halo} />
        <div className={styles.lightBeam} />
        <div className={styles.lighthouse}>
          <span className={styles.roof} />
          <span className={styles.lantern}><i /></span>
          <span className={styles.balcony} />
          <span className={styles.tower}><i /><i /><i /></span>
          <span className={styles.base} />
        </div>
        <div className={styles.water}><i /><i /><i /></div>
      </div>
      <section className={styles.copy}>
        <span className={styles.brand}>TRIPRI · KHÔNG GIAN LÀM VIỆC</span>
        <h1>Đang kiểm tra quyền truy cập</h1>
        <p>Đang chuẩn bị không gian làm việc của bạn.</p>
        <div className={styles.progress} aria-hidden="true"><span /></div>
        <span className={styles.visuallyHidden}>Đang kiểm tra quyền truy cập...</span>
      </section>
    </main>
  );
}
