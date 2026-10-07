-- ============================================================================
-- TRIPIN — KIỂM TRA TRƯỚC KHI ÁP RÀNG BUỘC
-- ============================================================================
-- Chạy trên DB ĐANG CÓ DỮ LIỆU trước khi thêm 49 FK / 36 CHECK / 7 NOT NULL của
-- `tripin.sql`. Script CHỈ ĐỌC, không sửa gì.
--
--   psql -d <db> -f docs/database/scope/preflight.sql
--
-- Không có WARNING/ô "CẦN XỬ LÝ" nào nghĩa là áp được ngay.
-- ============================================================================

\echo '=== 1. Tham chiếu mồ côi (sẽ chặn FOREIGN KEY) ==='

DO $$
DECLARE
  fk record;
  n bigint;
  bad int := 0;
BEGIN
  FOR fk IN
    SELECT * FROM (VALUES
      ('Tour','agencyId','User','id'),
      ('Tour','reviewedById','User','id'),
      ('TourGuideAssignment','guideId','User','id'),
      ('Booking','travelerId','User','id'),
      ('Booking','agencyId','User','id'),
      ('Booking','tourId','Tour','id'),
      ('Booking','departureId','TourDeparture','id'),
      ('Booking','promotionId','Promotion','id'),
      ('Payment','userId','User','id'),
      ('ETicket','bookingId','Booking','id'),
      ('ETicket','travelerId','User','id'),
      ('ETicket','agencyId','User','id'),
      ('ETicket','tourId','Tour','id'),
      ('Earning','guideId','User','id'),
      ('Earning','bookingId','Booking','id'),
      ('Earning','tourId','Tour','id'),
      ('Earning','agencyId','User','id'),
      ('Review','bookingId','Booking','id'),
      ('Review','tourId','Tour','id'),
      ('Review','agencyId','User','id'),
      ('Review','travelerId','User','id'),
      ('Review','moderatedById','User','id'),
      ('Report','reporterId','User','id'),
      ('Report','bookingId','Booking','id'),
      ('Report','agencyId','User','id'),
      ('Report','tourId','Tour','id'),
      ('Report','agencyResponseById','User','id'),
      ('Report','resolutionById','User','id'),
      ('Promotion','ownerId','User','id'),
      ('Promotion','createdById','User','id'),
      ('Subscription','userId','User','id'),
      ('SupportTicket','userId','User','id'),
      ('SupportTicket','bookingId','Booking','id'),
      ('SupportTicket','assignedToId','User','id'),
      ('SupportTicketMessage','authorId','User','id'),
      ('Notification','userId','User','id'),
      ('Conversation','travelerId','User','id'),
      ('Conversation','guideId','User','id'),
      ('Conversation','tourId','Tour','id'),
      ('Conversation','lastMessageSenderId','User','id'),
      ('Message','senderId','User','id'),
      ('AiConversation','userId','User','id'),
      ('AuditLog','actorId','User','id'),
      ('SystemSetting','updatedById','User','id'),
      ('WishlistItem','userId','User','id'),
      ('WishlistItem','tourId','Tour','id'),
      ('CartItem','userId','User','id'),
      ('CartItem','tourId','Tour','id'),
      ('CartItem','departureId','TourDeparture','id')
    ) AS v(child, col, parent, pcol)
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I c LEFT JOIN public.%I p ON p.%I = c.%I
        WHERE c.%I IS NOT NULL AND p.%I IS NULL',
      fk.child, fk.parent, fk.pcol, fk.col, fk.col, fk.pcol) INTO n;
    IF n > 0 THEN
      bad := bad + 1;
      RAISE WARNING 'MỒ CÔI: %.% — % dòng trỏ tới %.% không tồn tại',
        fk.child, fk.col, n, fk.parent, fk.pcol;
    END IF;
  END LOOP;
  IF bad = 0 THEN RAISE NOTICE 'OK: không có tham chiếu mồ côi nào.'; END IF;
END $$;

\echo ''
\echo '=== 2. Dữ liệu vi phạm CHECK (sẽ chặn CHECK) ==='

SELECT van_de, so_dong FROM (
  SELECT 'Tour.durationDays < 1'                    AS van_de, count(*) AS so_dong FROM public."Tour" WHERE "durationDays" < 1
  UNION ALL SELECT 'Tour.basePrice < 0',                       count(*) FROM public."Tour" WHERE "basePrice" < 0
  UNION ALL SELECT 'Tour.maxGroupSize < 1',                    count(*) FROM public."Tour" WHERE "maxGroupSize" < 1
  UNION ALL SELECT 'Tour.ratingAvg ngoài 0..5',                count(*) FROM public."Tour" WHERE "ratingAvg" < 0 OR "ratingAvg" > 5
  UNION ALL SELECT 'Tour.ratingCount < 0',                     count(*) FROM public."Tour" WHERE "ratingCount" < 0
  UNION ALL SELECT 'TourDeparture.capacity < 1',               count(*) FROM public."TourDeparture" WHERE "capacity" < 1
  UNION ALL SELECT 'TourDeparture.remaining ngoài 0..capacity', count(*) FROM public."TourDeparture" WHERE "remaining" < 0 OR "remaining" > "capacity"
  UNION ALL SELECT 'TourDeparture.priceOverride < 0',          count(*) FROM public."TourDeparture" WHERE "priceOverride" < 0
  UNION ALL SELECT 'TourGuideAssignment.feePerBooking < 0',    count(*) FROM public."TourGuideAssignment" WHERE "feePerBooking" < 0
  UNION ALL SELECT 'Booking.participants < 1',                 count(*) FROM public."Booking" WHERE "participants" < 1
  UNION ALL SELECT 'Booking tiền âm',                          count(*) FROM public."Booking" WHERE "unitPrice" < 0 OR "subtotal" < 0 OR "discountAmount" < 0 OR "totalAmount" < 0 OR "commissionAmount" < 0 OR "agencyAmount" < 0
  UNION ALL SELECT 'Booking total != subtotal - discount',     count(*) FROM public."Booking" WHERE "totalAmount" <> "subtotal" - "discountAmount"
  UNION ALL SELECT 'Booking commission sai công thức',         count(*) FROM public."Booking" WHERE "commissionBps" < 0 OR "commissionBps" > 10000 OR "commissionAmount" <> (("totalAmount"::bigint * "commissionBps") / 10000) OR "agencyAmount" <> "totalAmount" - "commissionAmount"
  UNION ALL SELECT 'Booking dưới 1 VND (D-74)',                count(*) FROM public."Booking" WHERE "subtotal" < 1 OR "totalAmount" < 1
  UNION ALL SELECT 'Booking endDate < departureDate',          count(*) FROM public."Booking" WHERE "endDate" < "departureDate"
  UNION ALL SELECT 'Payment.amount < 1',                       count(*) FROM public."Payment" WHERE "amount" < 1
  UNION ALL SELECT 'ETicket.participants < 1',                 count(*) FROM public."ETicket" WHERE "participants" < 1
  UNION ALL SELECT 'Earning.amount < 0',                       count(*) FROM public."Earning" WHERE "amount" < 0
  UNION ALL SELECT 'Review.rating ngoài 1..5',                 count(*) FROM public."Review" WHERE "rating" < 1 OR "rating" > 5
  UNION ALL SELECT 'Promotion.discountValue < 1',              count(*) FROM public."Promotion" WHERE "discountValue" < 1
  UNION ALL SELECT 'Promotion PERCENT > 100',                  count(*) FROM public."Promotion" WHERE "discountType" = 'PERCENT' AND "discountValue" > 100
  UNION ALL SELECT 'Promotion.minOrderAmount < 0',             count(*) FROM public."Promotion" WHERE "minOrderAmount" < 0
  UNION ALL SELECT 'Promotion.maxDiscountAmount < 0',          count(*) FROM public."Promotion" WHERE "maxDiscountAmount" < 0
  UNION ALL SELECT 'Promotion usedCount vượt usageLimit',      count(*) FROM public."Promotion" WHERE "usedCount" < 0 OR ("usageLimit" IS NOT NULL AND "usedCount" > "usageLimit")
  UNION ALL SELECT 'Promotion endsAt <= startsAt',             count(*) FROM public."Promotion" WHERE "endsAt" <= "startsAt"
  UNION ALL SELECT 'SubscriptionPlan.price < 0',               count(*) FROM public."SubscriptionPlan" WHERE "price" < 0
  UNION ALL SELECT 'SubscriptionPlan.durationDays < 1',        count(*) FROM public."SubscriptionPlan" WHERE "durationDays" < 1
  UNION ALL SELECT 'Subscription.price < 0',                   count(*) FROM public."Subscription" WHERE "price" < 0
  UNION ALL SELECT 'Subscription.durationDays < 1',            count(*) FROM public."Subscription" WHERE "durationDays" < 1
  UNION ALL SELECT 'Subscription endsAt <= startsAt',          count(*) FROM public."Subscription" WHERE "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" <= "startsAt"
  UNION ALL SELECT 'SupportTicket.messageCount < 0',           count(*) FROM public."SupportTicket" WHERE "messageCount" < 0
  UNION ALL SELECT 'Conversation unread âm',                   count(*) FROM public."Conversation" WHERE "unreadTraveler" < 0 OR "unreadGuide" < 0
  UNION ALL SELECT 'AiConversation.messageCount < 0',          count(*) FROM public."AiConversation" WHERE "messageCount" < 0
  UNION ALL SELECT 'Otp.attempts < 0',                         count(*) FROM public."Otp" WHERE "attempts" < 0
  UNION ALL SELECT 'Otp expiresAt <= issuedAt',                count(*) FROM public."Otp" WHERE "expiresAt" <= "issuedAt"
  UNION ALL SELECT 'CartItem.participants ngoài 1..50',        count(*) FROM public."CartItem" WHERE "participants" < 1 OR "participants" > 50
) v WHERE so_dong > 0;

\echo '(không có dòng nào ở trên = mọi CHECK áp được ngay)'
\echo ''
\echo '=== 3. Cột text[] đang NULL (sẽ chặn SET NOT NULL) ==='

SELECT van_de, so_dong FROM (
  SELECT 'User.extraPermissions'     AS van_de, count(*) AS so_dong FROM public."User"             WHERE "extraPermissions" IS NULL
  UNION ALL SELECT 'Tour.images',               count(*) FROM public."Tour"             WHERE "images" IS NULL
  UNION ALL SELECT 'Tour.inclusions',           count(*) FROM public."Tour"             WHERE "inclusions" IS NULL
  UNION ALL SELECT 'Tour.exclusions',           count(*) FROM public."Tour"             WHERE "exclusions" IS NULL
  UNION ALL SELECT 'GuideProfile.languages',    count(*) FROM public."GuideProfile"     WHERE "languages" IS NULL
  UNION ALL SELECT 'GuideProfile.specialties',  count(*) FROM public."GuideProfile"     WHERE "specialties" IS NULL
  UNION ALL SELECT 'SubscriptionPlan.benefits', count(*) FROM public."SubscriptionPlan" WHERE "benefits" IS NULL
) v WHERE so_dong > 0;

\echo '(không có dòng nào ở trên = SET NOT NULL áp được ngay)'
