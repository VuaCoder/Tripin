/** Recalculate public rating counters from visible Review rows only. */
import { connectDatabase, disconnectDatabase, prisma } from '../config/database';

async function main(): Promise<void> {
  await connectDatabase();
  try {
    const tours = await prisma.tour.findMany({ select: { id: true, ratingAvg: true, ratingCount: true } });
    let updated = 0;
    for (const tour of tours) {
      const stats = await prisma.review.aggregate({
        where: { tourId: tour.id, status: 'VISIBLE' },
        _avg: { rating: true },
        _count: { _all: true },
      });
      const ratingAvg = stats._avg.rating ?? 0;
      const ratingCount = stats._count._all;
      if (tour.ratingAvg === ratingAvg && tour.ratingCount === ratingCount) continue;
      await prisma.tour.update({ where: { id: tour.id }, data: { ratingAvg, ratingCount } });
      updated += 1;
    }
    console.log(`[sync-tour-ratings] synchronized ${updated} of ${tours.length} tour rating counters`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error('[sync-tour-ratings] Error:', error);
  process.exit(1);
});
