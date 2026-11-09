import styles from './tour-detail.module.css';

function Placeholder({ width = '100%', height = 16 }: { width?: string; height?: number }) {
  return <div className={styles.skeletonBlock} style={{ width, height }} />;
}

/** Reuse the detail layout so loading follows the same responsive breakpoints. */
export function TourDetailSkeleton() {
  return (
    <div className={styles.page} role="status" aria-label="Đang tải thông tin tour" aria-busy="true">
      <span className="sr-only">Đang tải thông tin tour…</span>
      <div aria-hidden="true">
        <div className={styles.titleRow}>
          <div className={styles.skeletonTitle}>
            <Placeholder width="85%" height={52} />
            <div className={styles.ratings}><Placeholder width="220px" height={20} /></div>
          </div>
          <div className={styles.titleActions}>
            {[0, 1, 2].map(i => <div key={i} className={styles.iconActionButton}><Placeholder height={22} width="22px" /></div>)}
          </div>
        </div>
        <div className={styles.gallery}>
          {[0, 1, 2].map(i => <div key={i} className={`${styles.photo} ${styles.skeletonBlock}`} />)}
        </div>
        <div className={styles.bodyGrid}>
          <div className={styles.mainContent}>
            <div className={styles.facts}><Placeholder width="190px" height={21} /><Placeholder width="90px" height={21} /><Placeholder width="180px" height={21} /></div>
            <div className={styles.skeletonAgency}>
              <Placeholder width="48px" height={48} />
              <div className={styles.skeletonTitle}><Placeholder width="65%" /><Placeholder width="80%" /></div>
            </div>
            <div className={styles.tabs}>
              {[0, 1, 2].map(i => <div key={i} className={styles.skeletonTab}><Placeholder width="100px" height={20} /></div>)}
            </div>
            <div className={styles.section}>
              <Placeholder width="230px" height={30} />
              <div className={styles.skeletonItinerary}>
                <Placeholder height={64} />
                <div className={styles.dayContent}><Placeholder /><Placeholder /><Placeholder width="75%" /></div>
                <Placeholder height={64} /><Placeholder height={64} />
              </div>
            </div>
          </div>
          <div className={styles.booking}>
            <div className={styles.priceHeader}>
              <Placeholder width="80px" height={14} />
              <div className={styles.skeletonPrice}><Placeholder width="210px" height={43} /></div>
              <div className={styles.tourCode}><Placeholder width="100%" height={16} /></div>
            </div>
            <div className={styles.bookingBody}>
              <div className={styles.bookingLabel}><Placeholder width="130px" /></div>
              <div className={styles.departureGrid}>{[0, 1, 2].map(i => <Placeholder key={i} height={59} />)}</div>
              {[0, 1, 2].map(i => <div className={styles.guestRow} key={i}><Placeholder width="45%" height={35} /><Placeholder width="95px" height={30} /></div>)}
              <div className={styles.totals}><Placeholder height={72} /></div>
              <Placeholder height={51} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
