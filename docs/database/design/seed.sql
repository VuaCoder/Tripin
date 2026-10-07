-- ============================================================================
-- TRIPIN — dữ liệu mẫu cho schema PostgreSQL hợp nhất
-- ============================================================================
-- Chạy SAU `tripin.sql`, trên database vừa tạo:
--   psql -v ON_ERROR_STOP=1 -d tripin -f docs/database/design/seed.sql
--
-- Nguồn: `mongo/init/01-init.js` của thiết kế cũ (mỗi collection đúng 1 sample
-- doc). Toàn bộ 15 sample doc đó được port nguyên sang đây.
--
-- KHÁC BIỆT so với bản Mongo: Mongo không có khoá ngoại nên các sample doc
-- trỏ tới `usr_1`, `sup_1`, `prd_1`, `bk_1` mà không hề tạo chúng. Postgres
-- cưỡng chế FK, nên mục 1–3 dưới đây THÊM các bản ghi cha tối thiểu để thoả
-- FK; mục 4 mới là 15 sample doc gốc.
--
-- Giờ nhập theo UTC+7 (giờ Việt Nam); PostgreSQL lưu timestamptz dưới dạng UTC.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. BẢN GHI CHA — THÊM MỚI (Mongo không có vì không cần FK)
-- ============================================================================

INSERT INTO "USER" ("id", "email", "role", "status", "locale", "currency") VALUES
  ('usr_1',       'traveller@example.com', 'TRAVELLER', 'ACTIVE', 'vi', 'VND'),
  ('usr_2',       'reporter@example.com',  'TRAVELLER', 'ACTIVE', 'vi', 'VND'),
  ('usr_sup_1',   'bus@example.com',       'SUPPLIER',  'ACTIVE', 'vi', 'VND'),
  ('usr_guide_1', 'guide@example.com',     'SUPPLIER',  'ACTIVE', 'vi', 'VND');

INSERT INTO "SUPPLIER"
  ("id", "userId", "type", "legalName", "displayName", "verified", "status")
VALUES
  ('sup_1',       'usr_sup_1',   'TRANSPORT', 'Cong ty Phuong Nam', 'Phuong Nam Bus', true, 'ACTIVE'),
  ('sup_guide_1', 'usr_guide_1', 'GUIDE',     'Huong dan vien Lan', 'Guide Lan',      true, 'ACTIVE');

INSERT INTO "TRANSPORT_PROFILE" ("supplierId", "name", "mode")
VALUES ('sup_1', 'Phuong Nam Bus', 'BUS');

INSERT INTO "GUIDE_PROFILE" ("supplierId", "languages")
VALUES ('sup_guide_1', 'vi,en');

-- ============================================================================
-- 2. ĐỊA BÀN & SẢN PHẨM — ZONE/LOCATION là sample gốc, PRODUCT là thêm mới
-- ============================================================================

INSERT INTO "ZONE" ("id", "name", "vibe")
VALUES ('zone_danang', 'Da Nang', 'beach');

INSERT INTO "LOCATION" ("id", "zoneId", "name", "lat", "lng")
VALUES ('loc_mykhe', 'zone_danang', 'My Khe Beach', 16.05, 108.24);

INSERT INTO "PRODUCT"
  ("id", "supplierId", "type", "zoneId", "title", "basePrice", "currency", "status", "isActive")
VALUES
  ('prd_1', 'sup_1', 'TRANSPORT', 'zone_danang', 'Ve xe Da Nang - Hue', 250000.00, 'VND', 'ACTIVE', true);

INSERT INTO "TRIP"
  ("id", "productId", "origin", "destination", "departScheduled", "arriveScheduled", "status")
VALUES
  ('trp_1', 'prd_1', 'Da Nang', 'Hue', '2026-10-10 07:00:00+07', '2026-10-10 11:00:00+07', 'SCHEDULED'),
  -- Chuyến chưa có lịch: cả ba cột của unique index đều NULL.
  -- Đây là lý do unique phải dùng NULLS NOT DISTINCT (xem tripin.sql).
  ('trp_2', 'prd_1', NULL, NULL, NULL, NULL, 'DRAFT');

-- ============================================================================
-- 3. ĐẶT CHỖ TỐI THIỂU — THÊM MỚI (REVIEW/REPORT trỏ tới bk_1 nhưng Mongo
--    không tạo BOOKING_GROUP/BOOKING)
-- ============================================================================

INSERT INTO "BOOKING_GROUP"
  ("id", "travellerUserId", "status", "totalAmount", "currency")
VALUES ('bg_1', 'usr_1', 'CONFIRMED', 250000.00, 'VND');

INSERT INTO "BOOKING"
  ("id", "groupId", "ref", "supplierId", "type", "totalAmount", "currency",
   "status", "idempotencyKey")
VALUES
  ('bk_1', 'bg_1', 'BK-0001', 'sup_1', 'INSTANT', 250000.00, 'VND',
   'CONFIRMED', 'seed-bk-1');

INSERT INTO "BOOKING_ITEM"
  ("id", "bookingId", "itemType", "productId", "tripId", "qty", "unitPrice")
VALUES ('bki_1', 'bk_1', 'SEAT', 'prd_1', 'trp_1', 1, 250000.00);

-- ============================================================================
-- 4. 15 SAMPLE DOC GỐC TỪ MONGO (port nguyên, chỉ đổi kiểu dữ liệu)
-- ============================================================================

-- --- Catalogue content (trước ở NoSQL) -------------------------------------

INSERT INTO "PRODUCT_CONTENT"
  ("id", "productId", "titleVi", "titleEn", "descriptionVi", "descriptionEn", "media", "amenities")
VALUES
  ('pc_1', 'prd_1', 'Khach san bien', 'Beach hotel', '', '', '[]'::jsonb, '[]'::jsonb);

INSERT INTO "PROFILE_CONTENT"
  ("id", "supplierId", "nameVi", "nameEn", "descriptionVi", "descriptionEn", "media", "policies")
VALUES
  ('pfc_1', 'sup_1', 'Nha xe Phuong Nam', 'Phuong Nam Bus', '', '', '[]'::jsonb, '');

-- --- Reviews ---------------------------------------------------------------

INSERT INTO "REVIEW"
  ("id", "targetType", "targetId", "bookingId", "travellerUserId", "rating",
   "title", "comment", "status", "createdAt")
VALUES
  ('rev_1', 'PRODUCT', 'prd_1', 'bk_1', 'usr_1', 5,
   'Tot', 'Dich vu tot', 'PUBLISHED', now());

INSERT INTO "REVIEW_SUMMARY"
  ("targetType", "targetId", "avgRating", "count", "distribution")
VALUES
  ('PRODUCT', 'prd_1', 5.0, 1, '{"5": 1}'::jsonb);

-- --- Engagement ------------------------------------------------------------

INSERT INTO "NOTIFICATION"
  ("id", "userId", "type", "title", "body", "channel", "refType", "refId",
   "isRead", "sentAt")
VALUES
  ('ntf_1', 'usr_1', 'BOOKING_CONFIRMED', 'Da xac nhan',
   'Booking bk_1 da xac nhan', 'IN_APP', 'BOOKING', 'bk_1', false, now());

INSERT INTO "WISHLIST" ("id", "travellerUserId", "productId", "createdAt")
VALUES ('wsh_1', 'usr_1', 'prd_1', now());

INSERT INTO "CART" ("id", "travellerUserId", "updatedAt")
VALUES ('cart_1', 'usr_1', now());

INSERT INTO "CART_ITEM" ("id", "cartId", "productId", "qty", "startDate", "endDate")
VALUES ('ci_1', 'cart_1', 'prd_1', 1, '2026-10-01', '2026-10-03');

-- --- Support ---------------------------------------------------------------

INSERT INTO "REPORT"
  ("id", "reporterUserId", "targetType", "targetId", "reason", "status", "createdAt")
VALUES
  ('rpt_1', 'usr_2', 'REVIEW', 'rev_1', 'Noi dung sai', 'OPEN', now());

INSERT INTO "HELP_ARTICLE" ("id", "title", "category", "body", "viewCount")
VALUES ('help_1', 'Cach huy booking', 'booking', '', 0);

INSERT INTO "TICKET" ("id", "userId", "subject", "priority", "status", "assigneeId", "createdAt")
VALUES ('tkt_1', 'usr_1', 'Chua nhan hoa don', 'NORMAL', 'OPEN', NULL, now());

INSERT INTO "TICKET_MESSAGE" ("id", "ticketId", "senderUserId", "message", "sentAt")
VALUES ('tkm_1', 'tkt_1', 'usr_1', 'Toi can hoa don', now());

-- --- Integration -----------------------------------------------------------

INSERT INTO "RAW_EVENT"
  ("id", "source", "externalId", "hash", "payload", "processedAt", "createdAt")
VALUES
  ('raw_1', 'OTA_X', 'ext_1', 'abc123', '{}'::jsonb, NULL, now());

-- --- Lịch nguồn lực (thêm mới, để minh hoạ ràng buộc chồng lấn của SLOT) ----

INSERT INTO "GUIDE_AVAILABILITY" ("id", "supplierId", "date", "timeSlot")
VALUES ('gav_1', 'sup_guide_1', '2026-10-10', 'MORNING');

INSERT INTO "SLOT"
  ("id", "resourceType", "resourceId", "refType", "refId", "startAt", "endAt", "status")
VALUES
  ('slot_1', 'GUIDE', 'sup_guide_1', 'SEGMENT', 'seg_demo_1',
   '2026-10-10 08:00:00+07', '2026-10-10 12:00:00+07', 'ACTIVE'),
  -- Kết thúc đúng lúc slot trước bắt đầu lại: '[)' nên KHÔNG bị coi là chồng lấn.
  ('slot_2', 'GUIDE', 'sup_guide_1', 'SEGMENT', 'seg_demo_2',
   '2026-10-10 12:00:00+07', '2026-10-10 17:00:00+07', 'ACTIVE');

COMMIT;

-- ============================================================================
-- KIỂM CHỨNG NHANH (chạy tay, không thuộc seed)
-- ============================================================================
-- 1) Ràng buộc chồng lấn của SLOT phải TỪ CHỐI câu này:
--      INSERT INTO "SLOT" ("id","resourceType","resourceId","refType","refId",
--                          "startAt","endAt","status")
--      VALUES ('slot_bad','GUIDE','sup_guide_1','SEGMENT','seg_demo_3',
--              '2026-10-10 11:00:00+07','2026-10-10 13:00:00+07','ACTIVE');
--    -> ERROR: conflicting key value violates exclusion constraint "slot_no_overlap"
--
-- 2) UNIQUE NULLS NOT DISTINCT của TRIP phải TỪ CHỐI câu này (trp_2 đã chiếm
--    tổ hợp (prd_1, NULL, NULL, NULL)):
--      INSERT INTO "TRIP" ("id","productId","status")
--      VALUES ('trp_dup','prd_1','DRAFT');
--    -> ERROR: duplicate key value violates unique constraint
--              "TRIP_productId_departScheduled_origin_destination_key"
--
-- 3) FK đã cưỡng chế thật (Mongo trước đây không chặn được):
--      INSERT INTO "WISHLIST" ("id","travellerUserId","productId")
--      VALUES ('wsh_bad','usr_khong_ton_tai','prd_1');
--    -> ERROR: insert or update on table "WISHLIST" violates foreign key
--              constraint "WISHLIST_travellerUserId_fkey"
--
-- 4) Trigger updatedAt:
--      UPDATE "CART" SET "updatedAt" = '2000-01-01' WHERE "id" = 'cart_1';
--      SELECT "updatedAt" FROM "CART" WHERE "id" = 'cart_1';  -- vẫn là now()
