-- ============================================================================
-- TRIPIN — PostgreSQL schema (MỘT STORE DUY NHẤT)
-- ============================================================================
-- Bản này thay thế thiết kế hai store (Postgres giao dịch + MongoDB nội dung).
-- Toàn bộ 56 bảng nằm trong một database PostgreSQL; mọi tham chiếu trước đây
-- chỉ là "logic" nay đã là FOREIGN KEY thật.
--
-- Sinh ra từ: docs/database/design/tripin.dbml (cùng thư mục)
-- Dữ liệu mẫu: docs/database/design/seed.sql
--
-- CÁCH CHẠY (trên database TRỐNG; script không idempotent, cố ý fail to):
--   createdb tripin
--   psql -v ON_ERROR_STOP=1 -d tripin -f docs/database/design/tripin.sql
--   psql -v ON_ERROR_STOP=1 -d tripin -f docs/database/design/seed.sql
--
-- LƯU Ý: đây là artifact THIẾT KẾ, không phải schema mà ứng dụng đang chạy.
-- Schema đang chạy là `prisma/schema.prisma` (xem docs/database/README.md).
--
-- Quy ước:
--   * Mọi giờ là UTC -> timestamptz.
--   * Tiền là VND -> numeric(14,2).
--   * Id là chuỗi opaque do ứng dụng sinh (giữ như DBML; repo thật dùng UUID).
--   * Tên bảng/cột giữ nguyên SCREAMING_SNAKE của DBML nên luôn phải quote.
-- ============================================================================

BEGIN;

-- Cần cho ràng buộc EXCLUDE của SLOT (trộn `=` trên text với `&&` trên range).
-- Thiết kế gốc THIẾU dòng này nên câu lệnh EXCLUDE của nó không chạy được.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- ENUM — chỉ đặt enum cho tập giá trị mà thiết kế gốc đã liệt kê.
-- Cột nào gốc ghi `varchar` không kèm danh sách giá trị thì giữ varchar.
-- ============================================================================

CREATE TYPE "user_role" AS ENUM (
  'TRAVELLER', 'SUPPLIER', 'PLATFORM_ADMIN', 'PLATFORM_MODERATOR',
  'PLATFORM_SUPPORT', 'PLATFORM_FINANCE'
);
CREATE TYPE "supplier_type" AS ENUM (
  'HOTEL', 'TRANSPORT', 'GUIDE', 'ACTIVITY', 'TOUR_OPERATOR'
);
CREATE TYPE "supplier_status" AS ENUM (
  'ONBOARDING', 'PENDING', 'ACTIVE', 'SUSPENDED'
);
CREATE TYPE "transport_mode" AS ENUM ('PLANE', 'TRAIN', 'BUS', 'FERRY');
CREATE TYPE "product_type" AS ENUM (
  'HOTEL', 'TRANSPORT', 'ACTIVITY', 'TOUR_PACKAGE'
);
CREATE TYPE "product_status" AS ENUM (
  'DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE'
);
CREATE TYPE "trip_event_type" AS ENUM ('DELAY', 'CANCEL');
CREATE TYPE "constraint_type" AS ENUM ('HARD', 'SOFT');
CREATE TYPE "hold_status" AS ENUM (
  'ACTIVE', 'CONFIRMED', 'EXPIRED', 'RELEASED'
);
CREATE TYPE "slot_resource_type" AS ENUM ('TRAVELLER', 'GUIDE');
CREATE TYPE "slot_ref_type" AS ENUM ('SEGMENT', 'BOOKING_ITEM');
CREATE TYPE "slot_status" AS ENUM ('ACTIVE', 'RELEASED');
CREATE TYPE "booking_type" AS ENUM ('INSTANT', 'REQUEST');
CREATE TYPE "booking_status" AS ENUM (
  'PENDING', 'HELD', 'CONFIRMED', 'CANCELLED', 'COMPLETED'
);
CREATE TYPE "booking_item_type" AS ENUM ('ROOM', 'SEAT', 'ACTIVITY');
CREATE TYPE "itinerary_status" AS ENUM (
  'DRAFT', 'BOOKED', 'ACTIVE', 'COMPLETED'
);
CREATE TYPE "segment_type" AS ENUM ('STAY', 'TRIP', 'ACTIVITY');
CREATE TYPE "chat_ref_type" AS ENUM ('BOOKING', 'TOUR_REQUEST');
CREATE TYPE "moderation_target_type" AS ENUM ('PROFILE', 'PRODUCT');
CREATE TYPE "moderation_status" AS ENUM (
  'PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'
);
CREATE TYPE "audit_action" AS ENUM (
  'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN'
);
CREATE TYPE "review_target_type" AS ENUM ('PRODUCT', 'SUPPLIER', 'GUIDE');
CREATE TYPE "review_status" AS ENUM ('PUBLISHED', 'HIDDEN');
CREATE TYPE "notification_channel" AS ENUM ('IN_APP', 'EMAIL');

-- ============================================================================
-- 1. DANH TÍNH & NHÀ CUNG CẤP
-- ============================================================================

CREATE TABLE "USER" (
  "id"           varchar       NOT NULL,
  "email"        varchar       NOT NULL,
  "phone"        varchar,
  "passwordHash" varchar,
  "role"         "user_role"   NOT NULL,
  "locale"       varchar,
  "currency"     varchar,
  "status"       varchar       NOT NULL,
  "createdAt"    timestamptz   NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "USER_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "USER_email_key" UNIQUE ("email")
);
CREATE INDEX "USER_role_status_idx" ON "USER" ("role", "status");

CREATE TABLE "SUPPLIER" (
  "id"            varchar           NOT NULL,
  "userId"        varchar           NOT NULL,
  "type"          "supplier_type"   NOT NULL,
  "legalName"     varchar,
  "displayName"   varchar,
  "taxId"         varchar,
  "licenseNo"     varchar,
  "licenseExpiry" date,
  "verified"      boolean           NOT NULL DEFAULT false,
  "status"        "supplier_status" NOT NULL,
  "ratingAvg"     double precision,
  "ratingCount"   integer           NOT NULL DEFAULT 0,
  "createdAt"     timestamptz       NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz       NOT NULL DEFAULT now(),
  CONSTRAINT "SUPPLIER_pkey"        PRIMARY KEY ("id"),
  -- DBML khai quan hệ 1-1 (`-`) nhưng không đánh unique -> bổ sung ở đây.
  CONSTRAINT "SUPPLIER_userId_key"  UNIQUE ("userId"),
  CONSTRAINT "SUPPLIER_ratingAvg_check"
    CHECK ("ratingAvg" IS NULL OR ("ratingAvg" >= 0 AND "ratingAvg" <= 5)),
  CONSTRAINT "SUPPLIER_ratingCount_check" CHECK ("ratingCount" >= 0),
  CONSTRAINT "SUPPLIER_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX "SUPPLIER_status_type_idx" ON "SUPPLIER" ("status", "type");

CREATE TABLE "HOTEL_PROFILE" (
  "supplierId"   varchar NOT NULL,
  "name"         varchar NOT NULL,
  "address"      varchar,
  "lat"          double precision,
  "lng"          double precision,
  "starRating"   integer,
  "checkInTime"  varchar,
  "checkOutTime" varchar,
  CONSTRAINT "HOTEL_PROFILE_pkey" PRIMARY KEY ("supplierId"),
  CONSTRAINT "HOTEL_PROFILE_starRating_check"
    CHECK ("starRating" IS NULL OR ("starRating" >= 0 AND "starRating" <= 5)),
  CONSTRAINT "HOTEL_PROFILE_supplierId_fkey" FOREIGN KEY ("supplierId")
    REFERENCES "SUPPLIER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE "TRANSPORT_PROFILE" (
  "supplierId" varchar          NOT NULL,
  "name"       varchar          NOT NULL,
  "mode"       "transport_mode" NOT NULL,
  CONSTRAINT "TRANSPORT_PROFILE_pkey" PRIMARY KEY ("supplierId"),
  CONSTRAINT "TRANSPORT_PROFILE_supplierId_fkey" FOREIGN KEY ("supplierId")
    REFERENCES "SUPPLIER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE "GUIDE_PROFILE" (
  "supplierId" varchar NOT NULL,
  "languages"  varchar,
  CONSTRAINT "GUIDE_PROFILE_pkey" PRIMARY KEY ("supplierId"),
  CONSTRAINT "GUIDE_PROFILE_supplierId_fkey" FOREIGN KEY ("supplierId")
    REFERENCES "SUPPLIER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE "AMENITY" (
  "id"       varchar NOT NULL,
  "name"     varchar NOT NULL,
  "category" varchar,
  "icon"     varchar,
  CONSTRAINT "AMENITY_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AMENITY_category_idx" ON "AMENITY" ("category");

CREATE TABLE "PROFILE_AMENITY" (
  "supplierId" varchar NOT NULL,
  "amenityId"  varchar NOT NULL,
  CONSTRAINT "PROFILE_AMENITY_pkey" PRIMARY KEY ("supplierId", "amenityId"),
  CONSTRAINT "PROFILE_AMENITY_supplierId_fkey" FOREIGN KEY ("supplierId")
    REFERENCES "SUPPLIER" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "PROFILE_AMENITY_amenityId_fkey" FOREIGN KEY ("amenityId")
    REFERENCES "AMENITY" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
-- PK đã phủ (supplierId); index này cho chiều tra ngược theo amenity.
CREATE INDEX "PROFILE_AMENITY_amenityId_idx" ON "PROFILE_AMENITY" ("amenityId");

-- ============================================================================
-- 2. ĐỊA BÀN, DANH MỤC, TỒN KHO, CHUYẾN
--    (ZONE/LOCATION trước đây ở NoSQL — nay ở Postgres nên PRODUCT.zoneId
--     mới có thể là FK.)
-- ============================================================================

CREATE TABLE "ZONE" (
  "id"   varchar NOT NULL,
  "name" varchar NOT NULL,
  "vibe" varchar,
  CONSTRAINT "ZONE_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ZONE_vibe_idx" ON "ZONE" ("vibe");

CREATE TABLE "LOCATION" (
  "id"     varchar NOT NULL,
  "zoneId" varchar NOT NULL,
  "name"   varchar NOT NULL,
  "lat"    double precision,
  "lng"    double precision,
  CONSTRAINT "LOCATION_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LOCATION_zoneId_fkey" FOREIGN KEY ("zoneId")
    REFERENCES "ZONE" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "LOCATION_zoneId_idx" ON "LOCATION" ("zoneId");

CREATE TABLE "PRODUCT" (
  "id"          varchar          NOT NULL,
  "supplierId"  varchar          NOT NULL,
  "type"        "product_type"   NOT NULL,
  "zoneId"      varchar,
  "title"       varchar          NOT NULL,
  "basePrice"   numeric(14,2)    NOT NULL,
  "currency"    varchar          NOT NULL,
  "lat"         double precision,
  "lng"         double precision,
  "ratingAvg"   double precision,
  "ratingCount" integer          NOT NULL DEFAULT 0,
  "status"      "product_status" NOT NULL,
  "isActive"    boolean          NOT NULL DEFAULT false,
  "createdAt"   timestamptz      NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT "PRODUCT_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PRODUCT_basePrice_check" CHECK ("basePrice" >= 0),
  CONSTRAINT "PRODUCT_ratingAvg_check"
    CHECK ("ratingAvg" IS NULL OR ("ratingAvg" >= 0 AND "ratingAvg" <= 5)),
  CONSTRAINT "PRODUCT_ratingCount_check" CHECK ("ratingCount" >= 0),
  CONSTRAINT "PRODUCT_supplierId_fkey" FOREIGN KEY ("supplierId")
    REFERENCES "SUPPLIER" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  -- MỚI: trước đây zoneId trỏ sang ZONE ở NoSQL, không cưỡng chế được.
  CONSTRAINT "PRODUCT_zoneId_fkey" FOREIGN KEY ("zoneId")
    REFERENCES "ZONE" ("id") ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE INDEX "PRODUCT_supplierId_idx"   ON "PRODUCT" ("supplierId");
CREATE INDEX "PRODUCT_zoneId_idx"       ON "PRODUCT" ("zoneId");
CREATE INDEX "PRODUCT_status_isActive_idx" ON "PRODUCT" ("status", "isActive");

CREATE TABLE "ROOM_TYPE" (
  "id"        varchar       NOT NULL,
  "productId" varchar       NOT NULL,
  "name"      varchar       NOT NULL,
  "capacity"  integer       NOT NULL,
  "bedType"   varchar,
  "sizeSqm"   double precision,
  "basePrice" numeric(14,2) NOT NULL,
  CONSTRAINT "ROOM_TYPE_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ROOM_TYPE_capacity_check"  CHECK ("capacity" > 0),
  CONSTRAINT "ROOM_TYPE_basePrice_check" CHECK ("basePrice" >= 0),
  CONSTRAINT "ROOM_TYPE_sizeSqm_check"   CHECK ("sizeSqm" IS NULL OR "sizeSqm" > 0),
  CONSTRAINT "ROOM_TYPE_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "PRODUCT" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "ROOM_TYPE_productId_idx" ON "ROOM_TYPE" ("productId");

CREATE TABLE "TRIP" (
  "id"              varchar     NOT NULL,
  "productId"       varchar     NOT NULL,
  "origin"          varchar,
  "destination"     varchar,
  "departScheduled" timestamptz,
  "arriveScheduled" timestamptz,
  "departEstimated" timestamptz,
  "departActual"    timestamptz,
  "status"          varchar     NOT NULL,
  "updatedAt"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "TRIP_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TRIP_schedule_check"
    CHECK ("arriveScheduled" IS NULL OR "departScheduled" IS NULL
           OR "arriveScheduled" >= "departScheduled"),
  CONSTRAINT "TRIP_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "PRODUCT" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
-- DBML không viết được NULLS NOT DISTINCT. Ba cột có thể NULL nên phải dùng
-- biến thể này (PostgreSQL 15+), nếu không hai chuyến cùng NULL sẽ lọt unique.
ALTER TABLE "TRIP" ADD CONSTRAINT "TRIP_productId_departScheduled_origin_destination_key"
  UNIQUE NULLS NOT DISTINCT ("productId", "departScheduled", "origin", "destination");
CREATE INDEX "TRIP_departScheduled_idx" ON "TRIP" ("departScheduled");

CREATE TABLE "TRIP_EVENT" (
  "id"        varchar          NOT NULL,
  "tripId"    varchar          NOT NULL,
  "type"      "trip_event_type" NOT NULL,
  "newTime"   timestamptz,
  "reason"    varchar,
  "source"    varchar,
  "createdAt" timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT "TRIP_EVENT_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TRIP_EVENT_tripId_fkey" FOREIGN KEY ("tripId")
    REFERENCES "TRIP" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "TRIP_EVENT_tripId_createdAt_idx" ON "TRIP_EVENT" ("tripId", "createdAt");

-- "order" là từ khoá SQL -> luôn quote.
CREATE TABLE "TOUR_PACKAGE_ITEM" (
  "id"               varchar           NOT NULL,
  "packageProductId" varchar           NOT NULL,
  "productId"        varchar           NOT NULL,
  "order"            integer           NOT NULL,
  "day"              integer           NOT NULL,
  "plannedOffsetMin" integer,
  "durationMin"      integer,
  "bufferMin"        integer,
  "constraintType"   "constraint_type" NOT NULL,
  "isOptional"       boolean           NOT NULL DEFAULT false,
  CONSTRAINT "TOUR_PACKAGE_ITEM_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TOUR_PACKAGE_ITEM_order_check" CHECK ("order" >= 0),
  CONSTRAINT "TOUR_PACKAGE_ITEM_day_check"   CHECK ("day" >= 0),
  CONSTRAINT "TOUR_PACKAGE_ITEM_plannedOffsetMin_check"
    CHECK ("plannedOffsetMin" IS NULL OR "plannedOffsetMin" >= 0),
  CONSTRAINT "TOUR_PACKAGE_ITEM_durationMin_check"
    CHECK ("durationMin" IS NULL OR "durationMin" >= 0),
  CONSTRAINT "TOUR_PACKAGE_ITEM_bufferMin_check"
    CHECK ("bufferMin" IS NULL OR "bufferMin" >= 0),
  CONSTRAINT "TOUR_PACKAGE_ITEM_packageProductId_fkey" FOREIGN KEY ("packageProductId")
    REFERENCES "PRODUCT" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "TOUR_PACKAGE_ITEM_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "PRODUCT" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "TOUR_PACKAGE_ITEM_packageProductId_order_key"
    UNIQUE ("packageProductId", "order")
);
CREATE INDEX "TOUR_PACKAGE_ITEM_productId_idx" ON "TOUR_PACKAGE_ITEM" ("productId");

CREATE TABLE "AVAILABILITY" (
  "id"         varchar       NOT NULL,
  "productId"  varchar       NOT NULL,
  "roomTypeId" varchar       NOT NULL,
  "date"       date          NOT NULL,
  "total"      integer       NOT NULL,
  "booked"     integer       NOT NULL DEFAULT 0,
  "held"       integer       NOT NULL DEFAULT 0,
  "price"      numeric(14,2) NOT NULL,
  "version"    integer       NOT NULL DEFAULT 0,
  CONSTRAINT "AVAILABILITY_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AVAILABILITY_total_check"  CHECK ("total" >= 0),
  CONSTRAINT "AVAILABILITY_booked_check" CHECK ("booked" >= 0),
  CONSTRAINT "AVAILABILITY_held_check"   CHECK ("held" >= 0),
  CONSTRAINT "AVAILABILITY_price_check"  CHECK ("price" >= 0),
  CONSTRAINT "AVAILABILITY_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "PRODUCT" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "AVAILABILITY_roomTypeId_fkey" FOREIGN KEY ("roomTypeId")
    REFERENCES "ROOM_TYPE" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "AVAILABILITY_productId_roomTypeId_date_key"
    UNIQUE ("productId", "roomTypeId", "date")
);
CREATE INDEX "AVAILABILITY_roomTypeId_idx" ON "AVAILABILITY" ("roomTypeId");
CREATE INDEX "AVAILABILITY_date_idx"       ON "AVAILABILITY" ("date");

CREATE TABLE "SEAT_INVENTORY" (
  "id"        varchar NOT NULL,
  "tripId"    varchar NOT NULL,
  "seatClass" varchar NOT NULL,
  "capacity"  integer NOT NULL,
  "booked"    integer NOT NULL DEFAULT 0,
  CONSTRAINT "SEAT_INVENTORY_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SEAT_INVENTORY_capacity_check" CHECK ("capacity" >= 0),
  CONSTRAINT "SEAT_INVENTORY_booked_check"   CHECK ("booked" >= 0),
  CONSTRAINT "SEAT_INVENTORY_tripId_fkey" FOREIGN KEY ("tripId")
    REFERENCES "TRIP" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "SEAT_INVENTORY_tripId_seatClass_key" UNIQUE ("tripId", "seatClass")
);

-- ============================================================================
-- 3. HÀNH TRÌNH, ĐẶT CHỖ
-- ============================================================================

CREATE TABLE "TRAVELLER" (
  "id"          varchar     NOT NULL,
  "ownerUserId" varchar     NOT NULL,
  "fullName"    varchar     NOT NULL,
  "dob"         date,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "TRAVELLER_pkey" PRIMARY KEY ("id"),
  -- DBML khai quan hệ 1-1 (`-`) nhưng không đánh unique -> bổ sung ở đây.
  CONSTRAINT "TRAVELLER_ownerUserId_key" UNIQUE ("ownerUserId"),
  CONSTRAINT "TRAVELLER_ownerUserId_fkey" FOREIGN KEY ("ownerUserId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE "ITINERARY" (
  "id"              varchar            NOT NULL,
  "travellerUserId" varchar            NOT NULL,
  "status"          "itinerary_status" NOT NULL,
  "currentVersion"  integer            NOT NULL DEFAULT 1,
  "createdAt"       timestamptz        NOT NULL DEFAULT now(),
  CONSTRAINT "ITINERARY_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ITINERARY_travellerUserId_fkey" FOREIGN KEY ("travellerUserId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "ITINERARY_travellerUserId_createdAt_idx"
  ON "ITINERARY" ("travellerUserId", "createdAt");

CREATE TABLE "ITINERARY_VERSION" (
  "id"          varchar     NOT NULL,
  "itineraryId" varchar     NOT NULL,
  "version"     integer     NOT NULL,
  "reason"      varchar,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ITINERARY_VERSION_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ITINERARY_VERSION_itineraryId_fkey" FOREIGN KEY ("itineraryId")
    REFERENCES "ITINERARY" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ITINERARY_VERSION_itineraryId_version_key"
    UNIQUE ("itineraryId", "version")
);

CREATE TABLE "ITINERARY_SEGMENT" (
  "id"                 varchar           NOT NULL,
  "itineraryVersionId" varchar           NOT NULL,
  "order"              integer           NOT NULL,
  "type"               "segment_type"    NOT NULL,
  "productId"          varchar,
  "tripId"             varchar,
  "bookingId"          varchar,
  "poiName"            varchar,
  "plannedStart"       timestamptz,
  "plannedEnd"         timestamptz,
  "actualStart"        timestamptz,
  "actualEnd"          timestamptz,
  "bufferMin"          integer,
  "constraintType"     "constraint_type" NOT NULL,
  "dependsOnOrder"     integer,
  CONSTRAINT "ITINERARY_SEGMENT_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ITINERARY_SEGMENT_order_check" CHECK ("order" >= 0),
  CONSTRAINT "ITINERARY_SEGMENT_bufferMin_check"
    CHECK ("bufferMin" IS NULL OR "bufferMin" >= 0),
  CONSTRAINT "ITINERARY_SEGMENT_itineraryVersionId_fkey" FOREIGN KEY ("itineraryVersionId")
    REFERENCES "ITINERARY_VERSION" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ITINERARY_SEGMENT_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "PRODUCT" ("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "ITINERARY_SEGMENT_tripId_fkey" FOREIGN KEY ("tripId")
    REFERENCES "TRIP" ("id") ON UPDATE CASCADE ON DELETE SET NULL,
  -- FK tới BOOKING được thêm sau khi BOOKING tồn tại (xem mục 3, sau BOOKING).
  CONSTRAINT "ITINERARY_SEGMENT_itineraryVersionId_order_key"
    UNIQUE ("itineraryVersionId", "order")
);
CREATE INDEX "ITINERARY_SEGMENT_productId_idx" ON "ITINERARY_SEGMENT" ("productId");
CREATE INDEX "ITINERARY_SEGMENT_tripId_idx"    ON "ITINERARY_SEGMENT" ("tripId");
CREATE INDEX "ITINERARY_SEGMENT_bookingId_idx" ON "ITINERARY_SEGMENT" ("bookingId");

CREATE TABLE "BOOKING_GROUP" (
  "id"              varchar       NOT NULL,
  "travellerUserId" varchar       NOT NULL,
  "itineraryId"     varchar,
  "status"          varchar       NOT NULL,
  "totalAmount"     numeric(14,2) NOT NULL,
  "currency"        varchar       NOT NULL,
  "createdAt"       timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "BOOKING_GROUP_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BOOKING_GROUP_totalAmount_check" CHECK ("totalAmount" >= 0),
  CONSTRAINT "BOOKING_GROUP_travellerUserId_fkey" FOREIGN KEY ("travellerUserId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "BOOKING_GROUP_itineraryId_fkey" FOREIGN KEY ("itineraryId")
    REFERENCES "ITINERARY" ("id") ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE INDEX "BOOKING_GROUP_travellerUserId_createdAt_idx"
  ON "BOOKING_GROUP" ("travellerUserId", "createdAt");
CREATE INDEX "BOOKING_GROUP_itineraryId_idx" ON "BOOKING_GROUP" ("itineraryId");

CREATE TABLE "BOOKING" (
  "id"             varchar          NOT NULL,
  "groupId"        varchar          NOT NULL,
  "ref"            varchar          NOT NULL,
  "supplierId"     varchar          NOT NULL,
  "type"           "booking_type"   NOT NULL,
  "totalAmount"    numeric(14,2)    NOT NULL,
  "currency"       varchar          NOT NULL,
  "status"         "booking_status" NOT NULL,
  "idempotencyKey" varchar,
  "createdAt"      timestamptz      NOT NULL DEFAULT now(),
  "updatedAt"      timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT "BOOKING_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BOOKING_ref_key"            UNIQUE ("ref"),
  CONSTRAINT "BOOKING_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "BOOKING_totalAmount_check"  CHECK ("totalAmount" >= 0),
  CONSTRAINT "BOOKING_groupId_fkey" FOREIGN KEY ("groupId")
    REFERENCES "BOOKING_GROUP" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "BOOKING_supplierId_fkey" FOREIGN KEY ("supplierId")
    REFERENCES "SUPPLIER" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX "BOOKING_groupId_idx"            ON "BOOKING" ("groupId");
CREATE INDEX "BOOKING_supplierId_createdAt_idx" ON "BOOKING" ("supplierId", "createdAt");
CREATE INDEX "BOOKING_status_createdAt_idx"   ON "BOOKING" ("status", "createdAt");

-- ITINERARY_SEGMENT được tạo trước BOOKING nên FK này phải thêm ở đây.
ALTER TABLE "ITINERARY_SEGMENT" ADD CONSTRAINT "ITINERARY_SEGMENT_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "BOOKING" ("id")
  ON UPDATE CASCADE ON DELETE SET NULL;

CREATE TABLE "BOOKING_ITEM" (
  "id"         varchar             NOT NULL,
  "bookingId"  varchar             NOT NULL,
  "itemType"   "booking_item_type" NOT NULL,
  "productId"  varchar             NOT NULL,
  "roomTypeId" varchar,
  "tripId"     varchar,
  "qty"        integer             NOT NULL,
  "unitPrice"  numeric(14,2)       NOT NULL,
  "startDate"  date,
  "endDate"    date,
  CONSTRAINT "BOOKING_ITEM_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BOOKING_ITEM_qty_check"       CHECK ("qty" > 0),
  CONSTRAINT "BOOKING_ITEM_unitPrice_check" CHECK ("unitPrice" >= 0),
  CONSTRAINT "BOOKING_ITEM_dates_check"
    CHECK ("endDate" IS NULL OR "startDate" IS NULL OR "endDate" >= "startDate"),
  CONSTRAINT "BOOKING_ITEM_bookingId_fkey" FOREIGN KEY ("bookingId")
    REFERENCES "BOOKING" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "BOOKING_ITEM_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "PRODUCT" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "BOOKING_ITEM_roomTypeId_fkey" FOREIGN KEY ("roomTypeId")
    REFERENCES "ROOM_TYPE" ("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "BOOKING_ITEM_tripId_fkey" FOREIGN KEY ("tripId")
    REFERENCES "TRIP" ("id") ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE INDEX "BOOKING_ITEM_bookingId_idx"  ON "BOOKING_ITEM" ("bookingId");
CREATE INDEX "BOOKING_ITEM_productId_idx"  ON "BOOKING_ITEM" ("productId");
CREATE INDEX "BOOKING_ITEM_roomTypeId_idx" ON "BOOKING_ITEM" ("roomTypeId");
CREATE INDEX "BOOKING_ITEM_tripId_idx"     ON "BOOKING_ITEM" ("tripId");

CREATE TABLE "BOOKING_TRAVELLER" (
  "bookingId"   varchar NOT NULL,
  "travellerId" varchar NOT NULL,
  CONSTRAINT "BOOKING_TRAVELLER_pkey" PRIMARY KEY ("bookingId", "travellerId"),
  CONSTRAINT "BOOKING_TRAVELLER_bookingId_fkey" FOREIGN KEY ("bookingId")
    REFERENCES "BOOKING" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "BOOKING_TRAVELLER_travellerId_fkey" FOREIGN KEY ("travellerId")
    REFERENCES "TRAVELLER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "BOOKING_TRAVELLER_travellerId_idx" ON "BOOKING_TRAVELLER" ("travellerId");

CREATE TABLE "BOOKING_EVENT" (
  "id"        varchar     NOT NULL,
  "bookingId" varchar     NOT NULL,
  "type"      varchar     NOT NULL,
  "payload"   text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "BOOKING_EVENT_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BOOKING_EVENT_bookingId_fkey" FOREIGN KEY ("bookingId")
    REFERENCES "BOOKING" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "BOOKING_EVENT_bookingId_createdAt_idx"
  ON "BOOKING_EVENT" ("bookingId", "createdAt");

-- ============================================================================
-- 4. GIỮ CHỖ & LỊCH NGUỒN LỰC
-- ============================================================================

CREATE TABLE "HOLD" (
  "id"             varchar       NOT NULL,
  "bookingGroupId" varchar       NOT NULL,
  "itemType"       varchar       NOT NULL,
  "productId"      varchar,
  "roomTypeId"     varchar,
  "tripId"         varchar,
  "date"           date,
  "qty"            integer       NOT NULL,
  "status"         "hold_status" NOT NULL,
  "expiresAt"      timestamptz   NOT NULL,
  CONSTRAINT "HOLD_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HOLD_qty_check" CHECK ("qty" > 0),
  CONSTRAINT "HOLD_bookingGroupId_fkey" FOREIGN KEY ("bookingGroupId")
    REFERENCES "BOOKING_GROUP" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "HOLD_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "PRODUCT" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "HOLD_roomTypeId_fkey" FOREIGN KEY ("roomTypeId")
    REFERENCES "ROOM_TYPE" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "HOLD_tripId_fkey" FOREIGN KEY ("tripId")
    REFERENCES "TRIP" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "HOLD_bookingGroupId_idx"     ON "HOLD" ("bookingGroupId");
CREATE INDEX "HOLD_productId_idx"          ON "HOLD" ("productId");
CREATE INDEX "HOLD_roomTypeId_idx"         ON "HOLD" ("roomTypeId");
CREATE INDEX "HOLD_tripId_idx"             ON "HOLD" ("tripId");
-- Cho sweep hết hạn hold (DBML gốc không có index này).
CREATE INDEX "HOLD_status_expiresAt_idx"   ON "HOLD" ("status", "expiresAt");

CREATE TABLE "SLOT" (
  "id"           varchar              NOT NULL,
  "resourceType" "slot_resource_type" NOT NULL,
  "resourceId"   varchar              NOT NULL,
  "refType"      "slot_ref_type"      NOT NULL,
  "refId"        varchar              NOT NULL,
  "startAt"      timestamptz          NOT NULL,
  "endAt"        timestamptz          NOT NULL,
  "status"       "slot_status"        NOT NULL,
  "createdAt"    timestamptz          NOT NULL DEFAULT now(),
  CONSTRAINT "SLOT_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SLOT_range_check" CHECK ("endAt" > "startAt")
);
CREATE INDEX "SLOT_resourceType_resourceId_startAt_endAt_idx"
  ON "SLOT" ("resourceType", "resourceId", "startAt", "endAt");
CREATE INDEX "SLOT_refType_refId_idx" ON "SLOT" ("refType", "refId");

-- Luật chồng lấn: một nguồn lực không thể có hai slot trùng giờ.
-- Cần `btree_gist` (đã tạo ở đầu file) vì EXCLUDE trộn `=` trên text với `&&`.
ALTER TABLE "SLOT" ADD CONSTRAINT "slot_no_overlap"
  EXCLUDE USING gist (
    "resourceType" WITH =,
    "resourceId"   WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  );

CREATE TABLE "GUIDE_AVAILABILITY" (
  "id"         varchar NOT NULL,
  "supplierId" varchar NOT NULL,
  "date"       date    NOT NULL,
  "timeSlot"   varchar NOT NULL,
  CONSTRAINT "GUIDE_AVAILABILITY_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GUIDE_AVAILABILITY_supplierId_fkey" FOREIGN KEY ("supplierId")
    REFERENCES "SUPPLIER" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "GUIDE_AVAILABILITY_supplierId_date_timeSlot_key"
    UNIQUE ("supplierId", "date", "timeSlot")
);

CREATE TABLE "TOUR_REQUEST" (
  "id"              varchar       NOT NULL,
  "travellerUserId" varchar       NOT NULL,
  "status"          varchar       NOT NULL,
  "preferredDate"   date          NOT NULL,
  "guestCount"      integer       NOT NULL,
  "depositAmount"   numeric(14,2),
  "createdAt"       timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "TOUR_REQUEST_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TOUR_REQUEST_guestCount_check" CHECK ("guestCount" > 0),
  CONSTRAINT "TOUR_REQUEST_depositAmount_check"
    CHECK ("depositAmount" IS NULL OR "depositAmount" >= 0),
  CONSTRAINT "TOUR_REQUEST_travellerUserId_fkey" FOREIGN KEY ("travellerUserId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "TOUR_REQUEST_travellerUserId_createdAt_idx"
  ON "TOUR_REQUEST" ("travellerUserId", "createdAt");
CREATE INDEX "TOUR_REQUEST_status_preferredDate_idx"
  ON "TOUR_REQUEST" ("status", "preferredDate");

CREATE TABLE "CHAT_THREAD" (
  "id"        varchar         NOT NULL,
  "refType"   "chat_ref_type" NOT NULL,
  "refId"     varchar         NOT NULL,
  "createdAt" timestamptz     NOT NULL DEFAULT now(),
  CONSTRAINT "CHAT_THREAD_pkey" PRIMARY KEY ("id")
  -- refId là polymorphic (BOOKING | TOUR_REQUEST) -> cố ý KHÔNG có FK.
);
CREATE INDEX "CHAT_THREAD_refType_refId_idx" ON "CHAT_THREAD" ("refType", "refId");

CREATE TABLE "CHAT_MESSAGE" (
  "id"           varchar     NOT NULL,
  "threadId"     varchar     NOT NULL,
  "senderUserId" varchar     NOT NULL,
  "message"      text        NOT NULL,
  "sentAt"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CHAT_MESSAGE_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CHAT_MESSAGE_threadId_fkey" FOREIGN KEY ("threadId")
    REFERENCES "CHAT_THREAD" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "CHAT_MESSAGE_senderUserId_fkey" FOREIGN KEY ("senderUserId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "CHAT_MESSAGE_threadId_sentAt_idx" ON "CHAT_MESSAGE" ("threadId", "sentAt");
CREATE INDEX "CHAT_MESSAGE_senderUserId_idx"    ON "CHAT_MESSAGE" ("senderUserId");

-- ============================================================================
-- 5. TIỀN
-- ============================================================================

CREATE TABLE "PAYMENT" (
  "id"              varchar       NOT NULL,
  "groupId"         varchar       NOT NULL,
  "travellerUserId" varchar       NOT NULL,
  "method"          varchar       NOT NULL,
  "amount"          numeric(14,2) NOT NULL,
  "currency"        varchar       NOT NULL,
  "status"          varchar       NOT NULL,
  "gatewayRef"      varchar,
  "paidAt"          timestamptz,
  "createdAt"       timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "PAYMENT_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PAYMENT_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "PAYMENT_groupId_fkey" FOREIGN KEY ("groupId")
    REFERENCES "BOOKING_GROUP" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "PAYMENT_travellerUserId_fkey" FOREIGN KEY ("travellerUserId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX "PAYMENT_groupId_idx"          ON "PAYMENT" ("groupId");
CREATE INDEX "PAYMENT_travellerUserId_idx"  ON "PAYMENT" ("travellerUserId");
CREATE INDEX "PAYMENT_status_createdAt_idx" ON "PAYMENT" ("status", "createdAt");

CREATE TABLE "PAYMENT_TRANSACTION" (
  "id"         varchar       NOT NULL,
  "paymentId"  varchar       NOT NULL,
  "type"       varchar       NOT NULL,
  "amount"     numeric(14,2) NOT NULL,
  "status"     varchar       NOT NULL,
  "gatewayRef" varchar,
  "createdAt"  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "PAYMENT_TRANSACTION_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PAYMENT_TRANSACTION_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "PAYMENT_TRANSACTION_paymentId_fkey" FOREIGN KEY ("paymentId")
    REFERENCES "PAYMENT" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "PAYMENT_TRANSACTION_paymentId_idx" ON "PAYMENT_TRANSACTION" ("paymentId");

CREATE TABLE "CANCELLATION_POLICY" (
  "id"            varchar     NOT NULL,
  "version"       integer     NOT NULL,
  "rules"         text        NOT NULL,
  "effectiveFrom" timestamptz NOT NULL,
  CONSTRAINT "CANCELLATION_POLICY_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "CANCELLATION_POLICY_version_key" UNIQUE ("version")
);

CREATE TABLE "REFUND" (
  "id"            varchar       NOT NULL,
  "bookingId"     varchar       NOT NULL,
  "paymentId"     varchar,
  "policyVersion" integer       NOT NULL,
  "amount"        numeric(14,2) NOT NULL,
  "reason"        varchar,
  "status"        varchar       NOT NULL,
  "createdAt"     timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "REFUND_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "REFUND_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "REFUND_bookingId_fkey" FOREIGN KEY ("bookingId")
    REFERENCES "BOOKING" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "REFUND_paymentId_fkey" FOREIGN KEY ("paymentId")
    REFERENCES "PAYMENT" ("id") ON UPDATE CASCADE ON DELETE SET NULL,
  -- MỚI: policyVersion trước đây là số rời; nay trỏ đúng bản policy đã áp dụng.
  CONSTRAINT "REFUND_policyVersion_fkey" FOREIGN KEY ("policyVersion")
    REFERENCES "CANCELLATION_POLICY" ("version") ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX "REFUND_bookingId_idx"     ON "REFUND" ("bookingId");
CREATE INDEX "REFUND_paymentId_idx"     ON "REFUND" ("paymentId");
CREATE INDEX "REFUND_policyVersion_idx" ON "REFUND" ("policyVersion");

CREATE TABLE "PAYOUT" (
  "id"         varchar       NOT NULL,
  "supplierId" varchar       NOT NULL,
  "period"     varchar       NOT NULL,
  "gross"      numeric(14,2) NOT NULL,
  "commission" numeric(14,2) NOT NULL,
  "net"        numeric(14,2) NOT NULL,
  "status"     varchar       NOT NULL,
  "paidAt"     timestamptz,
  CONSTRAINT "PAYOUT_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PAYOUT_gross_check"      CHECK ("gross" >= 0),
  CONSTRAINT "PAYOUT_commission_check" CHECK ("commission" >= 0),
  CONSTRAINT "PAYOUT_net_check"        CHECK ("net" >= 0),
  CONSTRAINT "PAYOUT_supplierId_fkey" FOREIGN KEY ("supplierId")
    REFERENCES "SUPPLIER" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX "PAYOUT_supplierId_period_idx" ON "PAYOUT" ("supplierId", "period");

CREATE TABLE "INVOICE" (
  "id"        varchar       NOT NULL,
  "refType"   varchar       NOT NULL,
  "refId"     varchar       NOT NULL,
  "invoiceNo" varchar       NOT NULL,
  "taxNo"     varchar,
  "amount"    numeric(14,2) NOT NULL,
  "issuedAt"  timestamptz   NOT NULL,
  CONSTRAINT "INVOICE_pkey"            PRIMARY KEY ("id"),
  -- Bổ sung: số hoá đơn phải duy nhất.
  CONSTRAINT "INVOICE_invoiceNo_key"   UNIQUE ("invoiceNo"),
  CONSTRAINT "INVOICE_amount_check"    CHECK ("amount" >= 0)
  -- Thiết kế gốc khai FK refId -> BOOKING.id, nhưng refType là polymorphic
  -- nên FK đó sẽ chặn hoá đơn không trỏ vào BOOKING. Bỏ FK, giữ index.
);
CREATE INDEX "INVOICE_refType_refId_idx" ON "INVOICE" ("refType", "refId");

CREATE TABLE "PLATFORM_SETTING" (
  "key"         varchar NOT NULL,
  "value"       varchar,
  "description" varchar,
  CONSTRAINT "PLATFORM_SETTING_pkey" PRIMARY KEY ("key")
);

-- ============================================================================
-- 6. KIỂM DUYỆT, AUDIT, TÍCH HỢP
-- ============================================================================

CREATE TABLE "MODERATION_REQUEST" (
  "id"          varchar                  NOT NULL,
  "supplierId"  varchar                  NOT NULL,
  "targetType"  "moderation_target_type" NOT NULL,
  "targetId"    varchar                  NOT NULL,
  "status"      "moderation_status"      NOT NULL,
  "submittedBy" varchar                  NOT NULL,
  "reviewerId"  varchar,
  "reason"      text,
  "submittedAt" timestamptz              NOT NULL,
  "reviewedAt"  timestamptz,
  CONSTRAINT "MODERATION_REQUEST_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MODERATION_REQUEST_supplierId_fkey" FOREIGN KEY ("supplierId")
    REFERENCES "SUPPLIER" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "MODERATION_REQUEST_submittedBy_fkey" FOREIGN KEY ("submittedBy")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "MODERATION_REQUEST_reviewerId_fkey" FOREIGN KEY ("reviewerId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE SET NULL
  -- targetId là polymorphic (PROFILE | PRODUCT) -> cố ý KHÔNG có FK.
);
CREATE INDEX "MODERATION_REQUEST_status_submittedAt_idx"
  ON "MODERATION_REQUEST" ("status", "submittedAt");
CREATE INDEX "MODERATION_REQUEST_supplierId_idx" ON "MODERATION_REQUEST" ("supplierId");
CREATE INDEX "MODERATION_REQUEST_submittedBy_idx" ON "MODERATION_REQUEST" ("submittedBy");
CREATE INDEX "MODERATION_REQUEST_reviewerId_idx"  ON "MODERATION_REQUEST" ("reviewerId");

CREATE TABLE "MODERATION_LOG" (
  "id"        varchar     NOT NULL,
  "requestId" varchar     NOT NULL,
  "actorId"   varchar     NOT NULL,
  "action"    varchar     NOT NULL,
  "note"      text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "MODERATION_LOG_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MODERATION_LOG_requestId_fkey" FOREIGN KEY ("requestId")
    REFERENCES "MODERATION_REQUEST" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "MODERATION_LOG_actorId_fkey" FOREIGN KEY ("actorId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX "MODERATION_LOG_requestId_createdAt_idx"
  ON "MODERATION_LOG" ("requestId", "createdAt");
CREATE INDEX "MODERATION_LOG_actorId_idx" ON "MODERATION_LOG" ("actorId");

CREATE TABLE "AUDIT_LOG" (
  "id"         varchar        NOT NULL,
  "actorId"    varchar,
  "action"     "audit_action" NOT NULL,
  "entityType" varchar,
  "entityId"   varchar,
  "beforeJson" text,
  "afterJson"  text,
  "ip"         varchar,
  "userAgent"  varchar,
  "requestId"  varchar,
  "createdAt"  timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT "AUDIT_LOG_pkey" PRIMARY KEY ("id"),
  -- actorId NULL = hành động do hệ thống/job thực hiện.
  CONSTRAINT "AUDIT_LOG_actorId_fkey" FOREIGN KEY ("actorId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE INDEX "AUDIT_LOG_actorId_createdAt_idx"    ON "AUDIT_LOG" ("actorId", "createdAt");
CREATE INDEX "AUDIT_LOG_entityType_entityId_createdAt_idx"
  ON "AUDIT_LOG" ("entityType", "entityId", "createdAt");
CREATE INDEX "AUDIT_LOG_createdAt_idx"            ON "AUDIT_LOG" ("createdAt");

CREATE TABLE "SUPPLIER_PAYOUT_ACCOUNT" (
  "id"          varchar NOT NULL,
  "supplierId"  varchar NOT NULL,
  "bankName"    varchar NOT NULL,
  "accountNo"   varchar NOT NULL,
  "accountName" varchar NOT NULL,
  "isDefault"   boolean NOT NULL DEFAULT false,
  CONSTRAINT "SUPPLIER_PAYOUT_ACCOUNT_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SUPPLIER_PAYOUT_ACCOUNT_supplierId_fkey" FOREIGN KEY ("supplierId")
    REFERENCES "SUPPLIER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "SUPPLIER_PAYOUT_ACCOUNT_supplierId_idx"
  ON "SUPPLIER_PAYOUT_ACCOUNT" ("supplierId");

CREATE TABLE "SUPPLIER_INTEGRATION" (
  "id"          varchar     NOT NULL,
  "supplierId"  varchar     NOT NULL,
  "channel"     varchar     NOT NULL,
  "credentials" text,
  "status"      varchar     NOT NULL,
  "lastSyncAt"  timestamptz,
  CONSTRAINT "SUPPLIER_INTEGRATION_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SUPPLIER_INTEGRATION_supplierId_fkey" FOREIGN KEY ("supplierId")
    REFERENCES "SUPPLIER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "SUPPLIER_INTEGRATION_supplierId_idx" ON "SUPPLIER_INTEGRATION" ("supplierId");

-- ============================================================================
-- 7. NỘI DUNG & TƯƠNG TÁC
--    Trước đây nằm ở MongoDB với validator + index riêng; nay là bảng Postgres
--    thật, và mọi tham chiếu sang bảng giao dịch đều đã thành FK.
--    Cột NOT NULL lấy theo danh sách `required` của validator Mongo cũ.
-- ============================================================================

CREATE TABLE "PRODUCT_CONTENT" (
  "id"            varchar NOT NULL,
  "productId"     varchar NOT NULL,
  "titleVi"       varchar,
  "titleEn"       varchar,
  "descriptionVi" text,
  "descriptionEn" text,
  "media"         jsonb,
  "amenities"     jsonb,
  CONSTRAINT "PRODUCT_CONTENT_pkey"        PRIMARY KEY ("id"),
  -- Trước đây Mongo có unique index trên productId -> giữ nguyên.
  CONSTRAINT "PRODUCT_CONTENT_productId_key" UNIQUE ("productId"),
  CONSTRAINT "PRODUCT_CONTENT_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "PRODUCT" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE "PROFILE_CONTENT" (
  "id"            varchar NOT NULL,
  "supplierId"    varchar NOT NULL,
  "nameVi"        varchar,
  "nameEn"        varchar,
  "descriptionVi" text,
  "descriptionEn" text,
  "media"         jsonb,
  "policies"      text,
  CONSTRAINT "PROFILE_CONTENT_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "PROFILE_CONTENT_supplierId_key" UNIQUE ("supplierId"),
  CONSTRAINT "PROFILE_CONTENT_supplierId_fkey" FOREIGN KEY ("supplierId")
    REFERENCES "SUPPLIER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE "REVIEW" (
  "id"              varchar              NOT NULL,
  "targetType"      "review_target_type" NOT NULL,
  "targetId"        varchar              NOT NULL,
  "bookingId"       varchar              NOT NULL,
  "travellerUserId" varchar              NOT NULL,
  "rating"          integer              NOT NULL,
  "title"           varchar,
  "comment"         text,
  "status"          "review_status"      NOT NULL,
  "createdAt"       timestamptz          NOT NULL DEFAULT now(),
  CONSTRAINT "REVIEW_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "REVIEW_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5),
  CONSTRAINT "REVIEW_bookingId_fkey" FOREIGN KEY ("bookingId")
    REFERENCES "BOOKING" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "REVIEW_travellerUserId_fkey" FOREIGN KEY ("travellerUserId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  -- Một booking chỉ review một lần cho mỗi loại target (giữ từ Mongo).
  CONSTRAINT "REVIEW_bookingId_targetType_key" UNIQUE ("bookingId", "targetType")
  -- targetId là polymorphic (PRODUCT | SUPPLIER | GUIDE) -> cố ý KHÔNG có FK.
);
CREATE INDEX "REVIEW_targetType_targetId_createdAt_idx"
  ON "REVIEW" ("targetType", "targetId", "createdAt");
CREATE INDEX "REVIEW_travellerUserId_idx" ON "REVIEW" ("travellerUserId");

CREATE TABLE "REVIEW_SUMMARY" (
  "targetType"   "review_target_type" NOT NULL,
  "targetId"     varchar              NOT NULL,
  "avgRating"    double precision     NOT NULL DEFAULT 0,
  "count"        integer              NOT NULL DEFAULT 0,
  "distribution" jsonb,
  CONSTRAINT "REVIEW_SUMMARY_pkey" PRIMARY KEY ("targetType", "targetId"),
  CONSTRAINT "REVIEW_SUMMARY_avgRating_check"
    CHECK ("avgRating" >= 0 AND "avgRating" <= 5),
  CONSTRAINT "REVIEW_SUMMARY_count_check" CHECK ("count" >= 0)
  -- Khoá chính là cặp polymorphic -> không có FK.
);

CREATE TABLE "NOTIFICATION" (
  "id"        varchar                NOT NULL,
  "userId"    varchar                NOT NULL,
  "type"      varchar                NOT NULL,
  "title"     varchar                NOT NULL,
  "body"      text,
  "channel"   "notification_channel" NOT NULL,
  "refType"   varchar,
  "refId"     varchar,
  "isRead"    boolean                NOT NULL DEFAULT false,
  "sentAt"    timestamptz            NOT NULL DEFAULT now(),
  "readAt"    timestamptz,
  CONSTRAINT "NOTIFICATION_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NOTIFICATION_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
  -- refType/refId là polymorphic -> cố ý KHÔNG có FK.
);
CREATE INDEX "NOTIFICATION_userId_isRead_sentAt_idx"
  ON "NOTIFICATION" ("userId", "isRead", "sentAt");

CREATE TABLE "WISHLIST" (
  "id"              varchar     NOT NULL,
  "travellerUserId" varchar     NOT NULL,
  "productId"       varchar     NOT NULL,
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "WISHLIST_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WISHLIST_travellerUserId_productId_key"
    UNIQUE ("travellerUserId", "productId"),
  CONSTRAINT "WISHLIST_travellerUserId_fkey" FOREIGN KEY ("travellerUserId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "WISHLIST_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "PRODUCT" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "WISHLIST_productId_idx" ON "WISHLIST" ("productId");

CREATE TABLE "CART" (
  "id"              varchar     NOT NULL,
  "travellerUserId" varchar     NOT NULL,
  "updatedAt"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CART_pkey" PRIMARY KEY ("id"),
  -- Một giỏ cho mỗi traveller (Mongo có unique index travellerUserId).
  CONSTRAINT "CART_travellerUserId_key" UNIQUE ("travellerUserId"),
  CONSTRAINT "CART_travellerUserId_fkey" FOREIGN KEY ("travellerUserId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE "CART_ITEM" (
  "id"        varchar NOT NULL,
  "cartId"    varchar NOT NULL,
  "productId" varchar NOT NULL,
  "qty"       integer NOT NULL,
  "startDate" date,
  "endDate"   date,
  CONSTRAINT "CART_ITEM_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CART_ITEM_qty_check" CHECK ("qty" > 0),
  CONSTRAINT "CART_ITEM_dates_check"
    CHECK ("endDate" IS NULL OR "startDate" IS NULL OR "endDate" >= "startDate"),
  CONSTRAINT "CART_ITEM_cartId_fkey" FOREIGN KEY ("cartId")
    REFERENCES "CART" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "CART_ITEM_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "PRODUCT" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "CART_ITEM_cartId_idx"    ON "CART_ITEM" ("cartId");
CREATE INDEX "CART_ITEM_productId_idx" ON "CART_ITEM" ("productId");

CREATE TABLE "REPORT" (
  "id"             varchar     NOT NULL,
  "reporterUserId" varchar     NOT NULL,
  "targetType"     varchar     NOT NULL,
  "targetId"       varchar     NOT NULL,
  "reason"         text,
  "status"         varchar     NOT NULL,
  "createdAt"      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "REPORT_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "REPORT_reporterUserId_fkey" FOREIGN KEY ("reporterUserId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
  -- targetType/targetId là polymorphic -> cố ý KHÔNG có FK.
);
CREATE INDEX "REPORT_status_createdAt_idx" ON "REPORT" ("status", "createdAt");
CREATE INDEX "REPORT_reporterUserId_idx"   ON "REPORT" ("reporterUserId");

CREATE TABLE "HELP_ARTICLE" (
  "id"        varchar NOT NULL,
  "title"     varchar NOT NULL,
  "category"  varchar,
  "body"      text,
  "viewCount" integer NOT NULL DEFAULT 0,
  CONSTRAINT "HELP_ARTICLE_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HELP_ARTICLE_viewCount_check" CHECK ("viewCount" >= 0)
);
CREATE INDEX "HELP_ARTICLE_category_idx" ON "HELP_ARTICLE" ("category");

CREATE TABLE "TICKET" (
  "id"         varchar     NOT NULL,
  "userId"     varchar     NOT NULL,
  "subject"    varchar     NOT NULL,
  "priority"   varchar,
  "status"     varchar     NOT NULL,
  "assigneeId" varchar,
  "createdAt"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "TICKET_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TICKET_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "TICKET_assigneeId_fkey" FOREIGN KEY ("assigneeId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE INDEX "TICKET_userId_status_idx"     ON "TICKET" ("userId", "status");
CREATE INDEX "TICKET_assigneeId_status_idx" ON "TICKET" ("assigneeId", "status");

CREATE TABLE "TICKET_MESSAGE" (
  "id"           varchar     NOT NULL,
  "ticketId"     varchar     NOT NULL,
  "senderUserId" varchar     NOT NULL,
  "message"      text        NOT NULL,
  "sentAt"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "TICKET_MESSAGE_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TICKET_MESSAGE_ticketId_fkey" FOREIGN KEY ("ticketId")
    REFERENCES "TICKET" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "TICKET_MESSAGE_senderUserId_fkey" FOREIGN KEY ("senderUserId")
    REFERENCES "USER" ("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "TICKET_MESSAGE_ticketId_sentAt_idx"
  ON "TICKET_MESSAGE" ("ticketId", "sentAt");
CREATE INDEX "TICKET_MESSAGE_senderUserId_idx" ON "TICKET_MESSAGE" ("senderUserId");

CREATE TABLE "RAW_EVENT" (
  "id"          varchar     NOT NULL,
  "source"      varchar     NOT NULL,
  "externalId"  varchar     NOT NULL,
  "hash"        varchar     NOT NULL,
  "payload"     jsonb,
  "processedAt" timestamptz,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "RAW_EVENT_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RAW_EVENT_source_externalId_hash_key"
    UNIQUE ("source", "externalId", "hash")
);
-- processedAt NULL = chưa xử lý; index cho sweep.
CREATE INDEX "RAW_EVENT_processedAt_idx" ON "RAW_EVENT" ("processedAt");

-- ============================================================================
-- 8. updatedAt TỰ ĐỘNG
--    Bảng nào có cột updatedAt thì Postgres tự set khi UPDATE, thay vì tin
--    vào tầng ứng dụng.
-- ============================================================================

CREATE OR REPLACE FUNCTION tripin_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "USER_set_updated_at"     BEFORE UPDATE ON "USER"
  FOR EACH ROW EXECUTE FUNCTION tripin_set_updated_at();
CREATE TRIGGER "SUPPLIER_set_updated_at" BEFORE UPDATE ON "SUPPLIER"
  FOR EACH ROW EXECUTE FUNCTION tripin_set_updated_at();
CREATE TRIGGER "PRODUCT_set_updated_at"  BEFORE UPDATE ON "PRODUCT"
  FOR EACH ROW EXECUTE FUNCTION tripin_set_updated_at();
CREATE TRIGGER "TRIP_set_updated_at"     BEFORE UPDATE ON "TRIP"
  FOR EACH ROW EXECUTE FUNCTION tripin_set_updated_at();
CREATE TRIGGER "BOOKING_set_updated_at"  BEFORE UPDATE ON "BOOKING"
  FOR EACH ROW EXECUTE FUNCTION tripin_set_updated_at();
CREATE TRIGGER "CART_set_updated_at"     BEFORE UPDATE ON "CART"
  FOR EACH ROW EXECUTE FUNCTION tripin_set_updated_at();

COMMIT;
