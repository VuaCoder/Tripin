-- ============================================================================
-- TRIPIN — SCHEMA ĐÚNG PHẠM VI ĐANG CODE (PostgreSQL)
-- ============================================================================
-- 29 bảng + 1 bảng join + 21 enum, khớp 1-1 với `prisma/schema.prisma`.
--
-- File này gồm HAI phần:
--   PHẦN 1  DDL do Prisma sinh ra — giữ nguyên từng ký tự (chỉ bỏ phần
--           SET/pg_dump header), nên nó là bản sao trung thực của DB đang chạy.
--   PHẦN 2  "PHẦN BỔ SUNG" — 49 FK, 36 CHECK, 26 index, 7 NOT NULL, 16 trigger
--           mà Prisma không khai được. Mọi khác biệt với DB đang chạy nằm ở đây.
--
-- Vì phần 1 là nguyên văn output của Prisma, mọi khác biệt giữa file này và DB
-- đang chạy đều là CỐ Ý và được liệt kê trong README.md cùng thư mục.
--
-- CÁCH CHẠY (database trống):
--   createdb tripin
--   psql -v ON_ERROR_STOP=1 -d tripin -f docs/database/scope/tripin.sql
--
-- LƯU Ý: đây là artifact THIẾT KẾ/soát xét. Schema ứng dụng đang chạy là
-- `prisma/schema.prisma`. Đừng copy file này vào `prisma/migrations/`.
-- ============================================================================

SET client_min_messages = warning;
SET standard_conforming_strings = on;

-- ============================================================================
-- PHẦN 1 — DDL PRISMA (nguyên văn)
-- ============================================================================

CREATE TYPE public."AgencyVerificationStatus" AS ENUM (
    'UNVERIFIED',
    'PENDING',
    'VERIFIED',
    'REJECTED'
);


--
-- Name: BookingCancelReason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BookingCancelReason" AS ENUM (
    'TRAVELER_REQUEST',
    'PAYMENT_EXPIRED'
);


--
-- Name: BookingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BookingStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: DiscountType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DiscountType" AS ENUM (
    'PERCENT',
    'FIXED'
);


--
-- Name: ETicketStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ETicketStatus" AS ENUM (
    'VALID',
    'USED',
    'CANCELLED'
);


--
-- Name: GuideAssignmentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."GuideAssignmentStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationType" AS ENUM (
    'TOUR_APPROVED',
    'TOUR_REJECTED',
    'TOUR_SUSPENDED',
    'GUIDE_ASSIGNED',
    'GUIDE_ASSIGNMENT_ANSWERED',
    'AGENCY_VERIFICATION_DECIDED',
    'BOOKING_CREATED',
    'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED',
    'BOOKING_COMPLETED',
    'PAYMENT_SUCCEEDED',
    'PAYMENT_FAILED',
    'ETICKET_ISSUED',
    'REVIEW_RECEIVED',
    'REVIEW_MODERATED',
    'REPORT_UPDATED',
    'REPORT_RESOLVED',
    'COMPLAINT_RECEIVED',
    'SUPPORT_REPLIED',
    'CHAT_MESSAGE',
    'SUBSCRIPTION_ACTIVATED',
    'EARNING_RECORDED'
);


--
-- Name: OtpPurpose; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OtpPurpose" AS ENUM (
    'REGISTER',
    'LOGIN_2FA',
    'FORGOT_PASSWORD'
);


--
-- Name: PaymentPurpose; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentPurpose" AS ENUM (
    'BOOKING',
    'SUBSCRIPTION'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'CANCELLED',
    'EXPIRED',
    'FAILED'
);


--
-- Name: PromotionScope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PromotionScope" AS ENUM (
    'AGENCY',
    'PLATFORM'
);


--
-- Name: ReportCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReportCategory" AS ENUM (
    'MISLEADING_INFO',
    'SAFETY',
    'SERVICE_QUALITY',
    'PAYMENT_OR_REFUND',
    'INAPPROPRIATE_CONTENT',
    'OTHER'
);


--
-- Name: ReportStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReportStatus" AS ENUM (
    'OPEN',
    'AGENCY_RESPONDED',
    'RESOLVED',
    'REJECTED'
);


--
-- Name: ReportTarget; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReportTarget" AS ENUM (
    'TOUR',
    'USER',
    'REVIEW'
);


--
-- Name: ReviewStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReviewStatus" AS ENUM (
    'VISIBLE',
    'HIDDEN'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'TRAVELER',
    'AGENCY',
    'TOUR_GUIDE',
    'MODERATOR',
    'SUPER_ADMIN'
);


--
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'PENDING_PAYMENT',
    'ACTIVE',
    'EXPIRED',
    'CANCELLED'
);


--
-- Name: TicketCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TicketCategory" AS ENUM (
    'BOOKING',
    'PAYMENT',
    'ACCOUNT',
    'TOUR',
    'OTHER'
);


--
-- Name: TicketStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TicketStatus" AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED'
);


--
-- Name: TourStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TourStatus" AS ENUM (
    'DRAFT',
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'SUSPENDED',
    'ARCHIVED'
);


--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserStatus" AS ENUM (
    'PENDING_VERIFICATION',
    'ACTIVE',
    'BANNED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AgencyProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AgencyProfile" (
    "userId" uuid NOT NULL,
    "companyName" text,
    description text,
    address text,
    website text,
    "licenseNumber" text,
    "verificationStatus" public."AgencyVerificationStatus" DEFAULT 'UNVERIFIED'::public."AgencyVerificationStatus" NOT NULL,
    "verifiedAt" timestamp(3) without time zone,
    "verifiedById" uuid,
    "verificationNote" text
);


--
-- Name: AiConversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiConversation" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    title text NOT NULL,
    "messageCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AiMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiMessage" (
    id uuid NOT NULL,
    "conversationId" uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id uuid NOT NULL,
    "actorId" uuid NOT NULL,
    "actorRole" public."Role" NOT NULL,
    action text NOT NULL,
    "targetType" text NOT NULL,
    "targetId" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Booking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Booking" (
    id uuid NOT NULL,
    "bookingCode" text NOT NULL,
    "travelerId" uuid NOT NULL,
    "agencyId" uuid NOT NULL,
    "tourId" uuid NOT NULL,
    "departureId" uuid NOT NULL,
    "tourTitle" text NOT NULL,
    "departureDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    participants integer NOT NULL,
    "contactName" text NOT NULL,
    "contactPhone" text NOT NULL,
    notes text,
    "unitPrice" integer NOT NULL,
    subtotal integer NOT NULL,
    "promotionId" uuid,
    "promotionCode" text,
    "promotionScope" public."PromotionScope",
    "discountAmount" integer DEFAULT 0 NOT NULL,
    "totalAmount" integer NOT NULL,
    "commissionBps" integer NOT NULL,
    "commissionAmount" integer NOT NULL,
    "agencyAmount" integer NOT NULL,
    status public."BookingStatus" DEFAULT 'PENDING'::public."BookingStatus" NOT NULL,
    "isPaid" boolean DEFAULT false NOT NULL,
    "refundRequired" boolean DEFAULT false NOT NULL,
    "paymentExpiresAt" timestamp(3) without time zone,
    "confirmedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "cancelledAt" timestamp(3) without time zone,
    "cancelReason" public."BookingCancelReason",
    "cancelNote" text,
    "clientRequestId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CartItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CartItem" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "tourId" uuid NOT NULL,
    "departureId" uuid NOT NULL,
    participants integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Category" (
    id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Conversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Conversation" (
    id uuid NOT NULL,
    "travelerId" uuid NOT NULL,
    "guideId" uuid NOT NULL,
    "tourId" uuid,
    "lastMessageText" text,
    "lastMessageSenderId" uuid,
    "lastMessageSentAt" timestamp(3) without time zone,
    "unreadTraveler" integer DEFAULT 0 NOT NULL,
    "unreadGuide" integer DEFAULT 0 NOT NULL,
    "lastActivityAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ETicket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ETicket" (
    id uuid NOT NULL,
    "bookingId" uuid NOT NULL,
    "bookingCode" text NOT NULL,
    code text NOT NULL,
    "travelerId" uuid NOT NULL,
    "agencyId" uuid NOT NULL,
    "tourId" uuid NOT NULL,
    "tourTitle" text NOT NULL,
    "departureDate" timestamp(3) without time zone NOT NULL,
    participants integer NOT NULL,
    "holderName" text NOT NULL,
    status public."ETicketStatus" DEFAULT 'VALID'::public."ETicketStatus" NOT NULL,
    "issuedAt" timestamp(3) without time zone NOT NULL,
    "cancelledAt" timestamp(3) without time zone,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Earning; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Earning" (
    id uuid NOT NULL,
    "guideId" uuid NOT NULL,
    "bookingId" uuid NOT NULL,
    "bookingCode" text NOT NULL,
    "tourId" uuid NOT NULL,
    "tourTitle" text NOT NULL,
    "agencyId" uuid NOT NULL,
    amount integer NOT NULL,
    "earnedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: GuideProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GuideProfile" (
    "userId" uuid NOT NULL,
    bio text,
    languages text[] DEFAULT ARRAY[]::text[],
    specialties text[] DEFAULT ARRAY[]::text[],
    "experienceYears" integer,
    "licenseNumber" text
);


--
-- Name: Message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Message" (
    id uuid NOT NULL,
    "conversationId" uuid NOT NULL,
    "senderId" uuid NOT NULL,
    text text NOT NULL,
    "readAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    type public."NotificationType" NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb,
    "readAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Otp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Otp" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    purpose public."OtpPurpose" NOT NULL,
    "codeHash" text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "issuedAt" timestamp(3) without time zone NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id uuid NOT NULL,
    purpose public."PaymentPurpose" NOT NULL,
    "userId" uuid NOT NULL,
    "referenceId" uuid NOT NULL,
    amount integer NOT NULL,
    currency text DEFAULT 'VND'::text NOT NULL,
    description text NOT NULL,
    provider text NOT NULL,
    "providerOrderCode" bigint NOT NULL,
    "providerPaymentLinkId" text,
    "checkoutUrl" text,
    "providerReference" text,
    status public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "paidAt" timestamp(3) without time zone,
    "failureReason" text,
    "fulfilledAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Promotion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Promotion" (
    id uuid NOT NULL,
    scope public."PromotionScope" NOT NULL,
    "ownerId" uuid,
    code text NOT NULL,
    title text NOT NULL,
    description text,
    "discountType" public."DiscountType" NOT NULL,
    "discountValue" integer NOT NULL,
    "maxDiscountAmount" integer,
    "minOrderAmount" integer DEFAULT 0 NOT NULL,
    "startsAt" timestamp(3) without time zone NOT NULL,
    "endsAt" timestamp(3) without time zone NOT NULL,
    "usageLimit" integer,
    "usedCount" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RefreshToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RefreshToken" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "tokenHash" text NOT NULL,
    family text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    ip text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Report; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Report" (
    id uuid NOT NULL,
    "reporterId" uuid NOT NULL,
    "targetType" public."ReportTarget" NOT NULL,
    "targetId" uuid NOT NULL,
    category public."ReportCategory" NOT NULL,
    description text NOT NULL,
    "bookingId" uuid,
    "agencyId" uuid,
    "tourId" uuid,
    status public."ReportStatus" DEFAULT 'OPEN'::public."ReportStatus" NOT NULL,
    "openKey" text,
    "agencyResponseText" text,
    "agencyResponseAt" timestamp(3) without time zone,
    "agencyResponseById" uuid,
    "resolutionDecision" public."ReportStatus",
    "resolutionNote" text,
    "resolutionById" uuid,
    "resolvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Review" (
    id uuid NOT NULL,
    "bookingId" uuid NOT NULL,
    "tourId" uuid NOT NULL,
    "tourTitle" text NOT NULL,
    "agencyId" uuid NOT NULL,
    "travelerId" uuid NOT NULL,
    rating integer NOT NULL,
    comment text NOT NULL,
    status public."ReviewStatus" DEFAULT 'VISIBLE'::public."ReviewStatus" NOT NULL,
    "hiddenReason" text,
    "moderatedById" uuid,
    "moderatedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Subscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Subscription" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "planId" uuid NOT NULL,
    "planCode" text NOT NULL,
    "planName" text NOT NULL,
    price integer NOT NULL,
    "durationDays" integer NOT NULL,
    status public."SubscriptionStatus" DEFAULT 'PENDING_PAYMENT'::public."SubscriptionStatus" NOT NULL,
    "startsAt" timestamp(3) without time zone,
    "endsAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SubscriptionPlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SubscriptionPlan" (
    id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    price integer NOT NULL,
    "durationDays" integer NOT NULL,
    benefits text[] DEFAULT ARRAY[]::text[],
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupportTicket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupportTicket" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    subject text NOT NULL,
    category public."TicketCategory" NOT NULL,
    "bookingId" uuid,
    status public."TicketStatus" DEFAULT 'OPEN'::public."TicketStatus" NOT NULL,
    "assignedToId" uuid,
    "messageCount" integer DEFAULT 0 NOT NULL,
    "lastMessageAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupportTicketMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupportTicketMessage" (
    id uuid NOT NULL,
    "ticketId" uuid NOT NULL,
    "authorId" uuid NOT NULL,
    "authorKind" text NOT NULL,
    text text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SystemSetting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SystemSetting" (
    id uuid NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    "updatedById" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Tour; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tour" (
    id uuid NOT NULL,
    "agencyId" uuid NOT NULL,
    title text NOT NULL,
    summary text,
    description text,
    destination text NOT NULL,
    "durationDays" integer NOT NULL,
    "basePrice" integer NOT NULL,
    "maxGroupSize" integer,
    images text[] DEFAULT ARRAY[]::text[],
    inclusions text[] DEFAULT ARRAY[]::text[],
    exclusions text[] DEFAULT ARRAY[]::text[],
    itinerary jsonb DEFAULT '[]'::jsonb NOT NULL,
    status public."TourStatus" DEFAULT 'DRAFT'::public."TourStatus" NOT NULL,
    "submittedAt" timestamp(3) without time zone,
    "reviewedAt" timestamp(3) without time zone,
    "reviewedById" uuid,
    "statusReason" text,
    "ratingAvg" double precision DEFAULT 0 NOT NULL,
    "ratingCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TourDeparture; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TourDeparture" (
    id uuid NOT NULL,
    "tourId" uuid NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    capacity integer NOT NULL,
    remaining integer NOT NULL,
    "priceOverride" integer,
    "isOpen" boolean DEFAULT true NOT NULL
);


--
-- Name: TourGuideAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TourGuideAssignment" (
    "tourId" uuid NOT NULL,
    "guideId" uuid NOT NULL,
    "feePerBooking" integer NOT NULL,
    status public."GuideAssignmentStatus" DEFAULT 'PENDING'::public."GuideAssignmentStatus" NOT NULL,
    "respondedAt" timestamp(3) without time zone,
    note text
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id uuid NOT NULL,
    email text NOT NULL,
    "passwordHash" text,
    "fullName" text NOT NULL,
    phone text,
    "avatarUrl" text,
    role public."Role" DEFAULT 'TRAVELER'::public."Role" NOT NULL,
    "extraPermissions" text[] DEFAULT ARRAY[]::text[],
    status public."UserStatus" DEFAULT 'PENDING_VERIFICATION'::public."UserStatus" NOT NULL,
    "emailVerifiedAt" timestamp(3) without time zone,
    "googleId" text,
    "twoFactorEnabled" boolean DEFAULT false NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "bannedAt" timestamp(3) without time zone,
    "bannedById" uuid,
    "banReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: WishlistItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WishlistItem" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "tourId" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: _CategoryToTour; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_CategoryToTour" (
    "A" uuid NOT NULL,
    "B" uuid NOT NULL
);


--
-- Name: AgencyProfile AgencyProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgencyProfile"
    ADD CONSTRAINT "AgencyProfile_pkey" PRIMARY KEY ("userId");


--
-- Name: AiConversation AiConversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiConversation"
    ADD CONSTRAINT "AiConversation_pkey" PRIMARY KEY (id);


--
-- Name: AiMessage AiMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiMessage"
    ADD CONSTRAINT "AiMessage_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: Booking Booking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Booking"
    ADD CONSTRAINT "Booking_pkey" PRIMARY KEY (id);


--
-- Name: CartItem CartItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CartItem"
    ADD CONSTRAINT "CartItem_pkey" PRIMARY KEY (id);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: Conversation Conversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conversation"
    ADD CONSTRAINT "Conversation_pkey" PRIMARY KEY (id);


--
-- Name: ETicket ETicket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ETicket"
    ADD CONSTRAINT "ETicket_pkey" PRIMARY KEY (id);


--
-- Name: Earning Earning_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Earning"
    ADD CONSTRAINT "Earning_pkey" PRIMARY KEY (id);


--
-- Name: GuideProfile GuideProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuideProfile"
    ADD CONSTRAINT "GuideProfile_pkey" PRIMARY KEY ("userId");


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Otp Otp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Otp"
    ADD CONSTRAINT "Otp_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: Promotion Promotion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Promotion"
    ADD CONSTRAINT "Promotion_pkey" PRIMARY KEY (id);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: Report Report_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_pkey" PRIMARY KEY (id);


--
-- Name: Review Review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_pkey" PRIMARY KEY (id);


--
-- Name: SubscriptionPlan SubscriptionPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SubscriptionPlan"
    ADD CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY (id);


--
-- Name: Subscription Subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY (id);


--
-- Name: SupportTicketMessage SupportTicketMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportTicketMessage"
    ADD CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY (id);


--
-- Name: SupportTicket SupportTicket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportTicket"
    ADD CONSTRAINT "SupportTicket_pkey" PRIMARY KEY (id);


--
-- Name: SystemSetting SystemSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SystemSetting"
    ADD CONSTRAINT "SystemSetting_pkey" PRIMARY KEY (id);


--
-- Name: TourDeparture TourDeparture_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TourDeparture"
    ADD CONSTRAINT "TourDeparture_pkey" PRIMARY KEY (id);


--
-- Name: TourGuideAssignment TourGuideAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TourGuideAssignment"
    ADD CONSTRAINT "TourGuideAssignment_pkey" PRIMARY KEY ("tourId");


--
-- Name: Tour Tour_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tour"
    ADD CONSTRAINT "Tour_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WishlistItem WishlistItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WishlistItem"
    ADD CONSTRAINT "WishlistItem_pkey" PRIMARY KEY (id);


--
-- Name: _CategoryToTour _CategoryToTour_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_CategoryToTour"
    ADD CONSTRAINT "_CategoryToTour_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: AgencyProfile_verificationStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgencyProfile_verificationStatus_idx" ON public."AgencyProfile" USING btree ("verificationStatus");


--
-- Name: AiConversation_userId_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiConversation_userId_updatedAt_idx" ON public."AiConversation" USING btree ("userId", "updatedAt" DESC);


--
-- Name: AiMessage_conversationId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON public."AiMessage" USING btree ("conversationId", "createdAt");


--
-- Name: AuditLog_action_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_action_createdAt_idx" ON public."AuditLog" USING btree (action, "createdAt" DESC);


--
-- Name: AuditLog_actorId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_actorId_createdAt_idx" ON public."AuditLog" USING btree ("actorId", "createdAt" DESC);


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt" DESC);


--
-- Name: AuditLog_targetType_targetId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON public."AuditLog" USING btree ("targetType", "targetId", "createdAt" DESC);


--
-- Name: Booking_agencyId_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_agencyId_createdAt_id_idx" ON public."Booking" USING btree ("agencyId", "createdAt" DESC, id DESC);


--
-- Name: Booking_agencyId_status_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_agencyId_status_createdAt_id_idx" ON public."Booking" USING btree ("agencyId", status, "createdAt" DESC, id DESC);


--
-- Name: Booking_bookingCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Booking_bookingCode_key" ON public."Booking" USING btree ("bookingCode");


--
-- Name: Booking_status_confirmedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_status_confirmedAt_idx" ON public."Booking" USING btree (status, "confirmedAt" DESC);


--
-- Name: Booking_status_endDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_status_endDate_idx" ON public."Booking" USING btree (status, "endDate");


--
-- Name: Booking_status_paymentExpiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_status_paymentExpiresAt_idx" ON public."Booking" USING btree (status, "paymentExpiresAt");


--
-- Name: Booking_tourId_departureId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_tourId_departureId_status_idx" ON public."Booking" USING btree ("tourId", "departureId", status);


--
-- Name: Booking_travelerId_clientRequestId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Booking_travelerId_clientRequestId_key" ON public."Booking" USING btree ("travelerId", "clientRequestId");


--
-- Name: Booking_travelerId_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Booking_travelerId_createdAt_id_idx" ON public."Booking" USING btree ("travelerId", "createdAt" DESC, id DESC);


--
-- Name: CartItem_userId_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CartItem_userId_createdAt_id_idx" ON public."CartItem" USING btree ("userId", "createdAt" DESC, id DESC);


--
-- Name: CartItem_userId_departureId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CartItem_userId_departureId_key" ON public."CartItem" USING btree ("userId", "departureId");


--
-- Name: Category_isActive_sortOrder_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Category_isActive_sortOrder_name_idx" ON public."Category" USING btree ("isActive", "sortOrder", name);


--
-- Name: Category_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Category_slug_key" ON public."Category" USING btree (slug);


--
-- Name: Conversation_guideId_lastActivityAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Conversation_guideId_lastActivityAt_id_idx" ON public."Conversation" USING btree ("guideId", "lastActivityAt" DESC, id DESC);


--
-- Name: Conversation_travelerId_guideId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Conversation_travelerId_guideId_key" ON public."Conversation" USING btree ("travelerId", "guideId");


--
-- Name: Conversation_travelerId_lastActivityAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Conversation_travelerId_lastActivityAt_id_idx" ON public."Conversation" USING btree ("travelerId", "lastActivityAt" DESC, id DESC);


--
-- Name: ETicket_bookingId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ETicket_bookingId_key" ON public."ETicket" USING btree ("bookingId");


--
-- Name: ETicket_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ETicket_code_key" ON public."ETicket" USING btree (code);


--
-- Name: ETicket_travelerId_issuedAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ETicket_travelerId_issuedAt_id_idx" ON public."ETicket" USING btree ("travelerId", "issuedAt" DESC, id DESC);


--
-- Name: Earning_bookingId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Earning_bookingId_key" ON public."Earning" USING btree ("bookingId");


--
-- Name: Earning_guideId_earnedAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Earning_guideId_earnedAt_id_idx" ON public."Earning" USING btree ("guideId", "earnedAt" DESC, id DESC);


--
-- Name: Message_conversationId_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_conversationId_createdAt_id_idx" ON public."Message" USING btree ("conversationId", "createdAt" DESC, id DESC);


--
-- Name: Notification_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_createdAt_idx" ON public."Notification" USING btree ("createdAt");


--
-- Name: Notification_userId_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_createdAt_id_idx" ON public."Notification" USING btree ("userId", "createdAt" DESC, id DESC);


--
-- Name: Notification_userId_readAt_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON public."Notification" USING btree ("userId", "readAt", "createdAt" DESC);


--
-- Name: Otp_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Otp_expiresAt_idx" ON public."Otp" USING btree ("expiresAt");


--
-- Name: Otp_userId_purpose_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Otp_userId_purpose_key" ON public."Otp" USING btree ("userId", purpose);


--
-- Name: Payment_providerOrderCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Payment_providerOrderCode_key" ON public."Payment" USING btree ("providerOrderCode");


--
-- Name: Payment_purpose_referenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_purpose_referenceId_idx" ON public."Payment" USING btree (purpose, "referenceId");


--
-- Name: Payment_purpose_referenceId_pending_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Payment_purpose_referenceId_pending_key" ON public."Payment" USING btree (purpose, "referenceId") WHERE (status = 'PENDING'::public."PaymentStatus");


--
-- Name: Payment_status_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_status_expiresAt_idx" ON public."Payment" USING btree (status, "expiresAt");


--
-- Name: Payment_status_fulfilledAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_status_fulfilledAt_idx" ON public."Payment" USING btree (status, "fulfilledAt");


--
-- Name: Payment_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_userId_createdAt_idx" ON public."Payment" USING btree ("userId", "createdAt" DESC);


--
-- Name: Promotion_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Promotion_code_key" ON public."Promotion" USING btree (code);


--
-- Name: Promotion_scope_ownerId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Promotion_scope_ownerId_createdAt_idx" ON public."Promotion" USING btree (scope, "ownerId", "createdAt" DESC);


--
-- Name: RefreshToken_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RefreshToken_expiresAt_idx" ON public."RefreshToken" USING btree ("expiresAt");


--
-- Name: RefreshToken_family_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RefreshToken_family_idx" ON public."RefreshToken" USING btree (family);


--
-- Name: RefreshToken_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON public."RefreshToken" USING btree ("tokenHash");


--
-- Name: RefreshToken_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RefreshToken_userId_idx" ON public."RefreshToken" USING btree ("userId");


--
-- Name: Report_agencyId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Report_agencyId_status_createdAt_idx" ON public."Report" USING btree ("agencyId", status, "createdAt" DESC);


--
-- Name: Report_openKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Report_openKey_key" ON public."Report" USING btree ("openKey");


--
-- Name: Report_reporterId_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Report_reporterId_createdAt_id_idx" ON public."Report" USING btree ("reporterId", "createdAt" DESC, id DESC);


--
-- Name: Report_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Report_status_createdAt_idx" ON public."Report" USING btree (status, "createdAt" DESC);


--
-- Name: Review_agencyId_status_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Review_agencyId_status_createdAt_id_idx" ON public."Review" USING btree ("agencyId", status, "createdAt" DESC, id DESC);


--
-- Name: Review_bookingId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Review_bookingId_key" ON public."Review" USING btree ("bookingId");


--
-- Name: Review_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Review_status_createdAt_idx" ON public."Review" USING btree (status, "createdAt" DESC);


--
-- Name: Review_tourId_status_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Review_tourId_status_createdAt_id_idx" ON public."Review" USING btree ("tourId", status, "createdAt" DESC, id DESC);


--
-- Name: Review_tourId_status_rating_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Review_tourId_status_rating_idx" ON public."Review" USING btree ("tourId", status, rating DESC);


--
-- Name: Review_travelerId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Review_travelerId_createdAt_idx" ON public."Review" USING btree ("travelerId", "createdAt" DESC);


--
-- Name: SubscriptionPlan_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON public."SubscriptionPlan" USING btree (code);


--
-- Name: SubscriptionPlan_isActive_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SubscriptionPlan_isActive_sortOrder_idx" ON public."SubscriptionPlan" USING btree ("isActive", "sortOrder");


--
-- Name: Subscription_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subscription_status_createdAt_idx" ON public."Subscription" USING btree (status, "createdAt");


--
-- Name: Subscription_status_endsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subscription_status_endsAt_idx" ON public."Subscription" USING btree (status, "endsAt");


--
-- Name: Subscription_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subscription_userId_createdAt_idx" ON public."Subscription" USING btree ("userId", "createdAt" DESC);


--
-- Name: Subscription_userId_planId_pending_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Subscription_userId_planId_pending_key" ON public."Subscription" USING btree ("userId", "planId") WHERE (status = 'PENDING_PAYMENT'::public."SubscriptionStatus");


--
-- Name: Subscription_userId_status_endsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Subscription_userId_status_endsAt_idx" ON public."Subscription" USING btree ("userId", status, "endsAt" DESC);


--
-- Name: SupportTicketMessage_ticketId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicketMessage_ticketId_createdAt_idx" ON public."SupportTicketMessage" USING btree ("ticketId", "createdAt");


--
-- Name: SupportTicket_category_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_category_status_createdAt_idx" ON public."SupportTicket" USING btree (category, status, "createdAt");


--
-- Name: SupportTicket_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_createdAt_idx" ON public."SupportTicket" USING btree ("createdAt");


--
-- Name: SupportTicket_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_status_createdAt_idx" ON public."SupportTicket" USING btree (status, "createdAt");


--
-- Name: SupportTicket_userId_lastMessageAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupportTicket_userId_lastMessageAt_idx" ON public."SupportTicket" USING btree ("userId", "lastMessageAt" DESC);


--
-- Name: SystemSetting_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SystemSetting_key_key" ON public."SystemSetting" USING btree (key);


--
-- Name: TourDeparture_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TourDeparture_date_idx" ON public."TourDeparture" USING btree (date);


--
-- Name: TourDeparture_tourId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TourDeparture_tourId_idx" ON public."TourDeparture" USING btree ("tourId");


--
-- Name: TourGuideAssignment_guideId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TourGuideAssignment_guideId_idx" ON public."TourGuideAssignment" USING btree ("guideId");


--
-- Name: Tour_agencyId_status_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tour_agencyId_status_updatedAt_idx" ON public."Tour" USING btree ("agencyId", status, "updatedAt" DESC);


--
-- Name: Tour_status_basePrice_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tour_status_basePrice_id_idx" ON public."Tour" USING btree (status, "basePrice", id);


--
-- Name: Tour_status_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tour_status_createdAt_id_idx" ON public."Tour" USING btree (status, "createdAt" DESC, id DESC);


--
-- Name: Tour_status_ratingAvg_ratingCount_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tour_status_ratingAvg_ratingCount_id_idx" ON public."Tour" USING btree (status, "ratingAvg" DESC, "ratingCount" DESC, id DESC);


--
-- Name: Tour_status_submittedAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tour_status_submittedAt_id_idx" ON public."Tour" USING btree (status, "submittedAt" DESC, id DESC);


--
-- Name: User_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_createdAt_idx" ON public."User" USING btree ("createdAt" DESC);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_googleId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_googleId_key" ON public."User" USING btree ("googleId");


--
-- Name: User_role_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_role_status_createdAt_idx" ON public."User" USING btree (role, status, "createdAt" DESC);


--
-- Name: WishlistItem_userId_createdAt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WishlistItem_userId_createdAt_id_idx" ON public."WishlistItem" USING btree ("userId", "createdAt" DESC, id DESC);


--
-- Name: WishlistItem_userId_tourId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WishlistItem_userId_tourId_key" ON public."WishlistItem" USING btree ("userId", "tourId");


--
-- Name: _CategoryToTour_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_CategoryToTour_B_index" ON public."_CategoryToTour" USING btree ("B");


--
-- Name: AgencyProfile AgencyProfile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgencyProfile"
    ADD CONSTRAINT "AgencyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AiMessage AiMessage_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiMessage"
    ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public."AiConversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GuideProfile GuideProfile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuideProfile"
    ADD CONSTRAINT "GuideProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Message Message_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public."Conversation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Subscription Subscription_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."SubscriptionPlan"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SupportTicketMessage SupportTicketMessage_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupportTicketMessage"
    ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."SupportTicket"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TourDeparture TourDeparture_tourId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TourDeparture"
    ADD CONSTRAINT "TourDeparture_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES public."Tour"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TourGuideAssignment TourGuideAssignment_tourId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TourGuideAssignment"
    ADD CONSTRAINT "TourGuideAssignment_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES public."Tour"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_bannedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: _CategoryToTour _CategoryToTour_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_CategoryToTour"
    ADD CONSTRAINT "_CategoryToTour_A_fkey" FOREIGN KEY ("A") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _CategoryToTour _CategoryToTour_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_CategoryToTour"
    ADD CONSTRAINT "_CategoryToTour_B_fkey" FOREIGN KEY ("B") REFERENCES public."Tour"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--

-- ============================================================================
-- PHẦN BỔ SUNG — những gì Prisma KHÔNG khai được
-- ============================================================================
-- Toàn bộ phần trên file này là DDL do Prisma sinh ra (giữ nguyên từng ký tự, chỉ
-- bỏ phần SET/pg_dump header), nên mọi khác biệt dưới đây là CỐ Ý.
--
-- 49 FOREIGN KEY · 36 CHECK · 26 INDEX · 7 NOT NULL · 16 TRIGGER
--
-- Mọi ràng buộc ở đây đều đã được cưỡng chế sẵn trong code (zod schema, policy
-- constant, hoặc compare-and-set); DB chỉ đang thi hành lại điều code đã hứa.
-- Không có luật nghiệp vụ nào được thêm mới ở đây.
-- ============================================================================

-- ============================================================================
-- A. FOREIGN KEY còn thiếu (49)
--    Prisma chỉ tạo FK cho 11 quan hệ được khai bằng @relation. 49 tham chiếu
--    còn lại là cột uuid trần, nên DB hiện KHÔNG hề chặn tham chiếu mồ côi.
--
--    Quy ước ON DELETE đã chọn:
--      CASCADE  — dòng con thuộc sở hữu dòng cha (profile, tin nhắn, giỏ, wishlist)
--      RESTRICT — dòng tiền / audit / danh tính: không được mất cha
--      SET NULL — cột nullable chỉ để ghi công (ai duyệt, ai xử lý)
--    An toàn vì code KHÔNG hard-delete User / Tour / Booking (user bị ban, tour bị
--    ARCHIVED, booking bị CANCELLED — xem D-14, D-61).
-- ============================================================================

-- ---- A1. Nhà cung cấp & danh mục -------------------------------------------------
ALTER TABLE ONLY public."Tour"
  ADD CONSTRAINT "Tour_agencyId_fkey" FOREIGN KEY ("agencyId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Tour"
  ADD CONSTRAINT "Tour_reviewedById_fkey" FOREIGN KEY ("reviewedById")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."TourGuideAssignment"
  ADD CONSTRAINT "TourGuideAssignment_guideId_fkey" FOREIGN KEY ("guideId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- ---- A2. Đặt chỗ & tiền ----------------------------------------------------------
ALTER TABLE ONLY public."Booking"
  ADD CONSTRAINT "Booking_travelerId_fkey" FOREIGN KEY ("travelerId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Booking"
  ADD CONSTRAINT "Booking_agencyId_fkey" FOREIGN KEY ("agencyId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Booking"
  ADD CONSTRAINT "Booking_tourId_fkey" FOREIGN KEY ("tourId")
  REFERENCES public."Tour"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Booking"
  ADD CONSTRAINT "Booking_departureId_fkey" FOREIGN KEY ("departureId")
  REFERENCES public."TourDeparture"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Booking"
  ADD CONSTRAINT "Booking_promotionId_fkey" FOREIGN KEY ("promotionId")
  REFERENCES public."Promotion"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Payment"
  ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."ETicket"
  ADD CONSTRAINT "ETicket_bookingId_fkey" FOREIGN KEY ("bookingId")
  REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."ETicket"
  ADD CONSTRAINT "ETicket_travelerId_fkey" FOREIGN KEY ("travelerId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."ETicket"
  ADD CONSTRAINT "ETicket_agencyId_fkey" FOREIGN KEY ("agencyId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."ETicket"
  ADD CONSTRAINT "ETicket_tourId_fkey" FOREIGN KEY ("tourId")
  REFERENCES public."Tour"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Earning"
  ADD CONSTRAINT "Earning_guideId_fkey" FOREIGN KEY ("guideId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Earning"
  ADD CONSTRAINT "Earning_bookingId_fkey" FOREIGN KEY ("bookingId")
  REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Earning"
  ADD CONSTRAINT "Earning_tourId_fkey" FOREIGN KEY ("tourId")
  REFERENCES public."Tour"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Earning"
  ADD CONSTRAINT "Earning_agencyId_fkey" FOREIGN KEY ("agencyId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- ---- A3. Đánh giá & báo cáo ------------------------------------------------------
ALTER TABLE ONLY public."Review"
  ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId")
  REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."Review"
  ADD CONSTRAINT "Review_tourId_fkey" FOREIGN KEY ("tourId")
  REFERENCES public."Tour"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Review"
  ADD CONSTRAINT "Review_agencyId_fkey" FOREIGN KEY ("agencyId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Review"
  ADD CONSTRAINT "Review_travelerId_fkey" FOREIGN KEY ("travelerId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Review"
  ADD CONSTRAINT "Review_moderatedById_fkey" FOREIGN KEY ("moderatedById")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Report"
  ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Report"
  ADD CONSTRAINT "Report_bookingId_fkey" FOREIGN KEY ("bookingId")
  REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Report"
  ADD CONSTRAINT "Report_agencyId_fkey" FOREIGN KEY ("agencyId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Report"
  ADD CONSTRAINT "Report_tourId_fkey" FOREIGN KEY ("tourId")
  REFERENCES public."Tour"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Report"
  ADD CONSTRAINT "Report_agencyResponseById_fkey" FOREIGN KEY ("agencyResponseById")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Report"
  ADD CONSTRAINT "Report_resolutionById_fkey" FOREIGN KEY ("resolutionById")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- ---- A4. Khuyến mãi & gói thuê bao ----------------------------------------------
ALTER TABLE ONLY public."Promotion"
  ADD CONSTRAINT "Promotion_ownerId_fkey" FOREIGN KEY ("ownerId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Promotion"
  ADD CONSTRAINT "Promotion_createdById_fkey" FOREIGN KEY ("createdById")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."Subscription"
  ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- ---- A5. Hỗ trợ khách hàng -------------------------------------------------------
ALTER TABLE ONLY public."SupportTicket"
  ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."SupportTicket"
  ADD CONSTRAINT "SupportTicket_bookingId_fkey" FOREIGN KEY ("bookingId")
  REFERENCES public."Booking"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."SupportTicket"
  ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."SupportTicketMessage"
  ADD CONSTRAINT "SupportTicketMessage_authorId_fkey" FOREIGN KEY ("authorId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- ---- A6. Thông báo, chat, AI -----------------------------------------------------
ALTER TABLE ONLY public."Notification"
  ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."Conversation"
  ADD CONSTRAINT "Conversation_travelerId_fkey" FOREIGN KEY ("travelerId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."Conversation"
  ADD CONSTRAINT "Conversation_guideId_fkey" FOREIGN KEY ("guideId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."Conversation"
  ADD CONSTRAINT "Conversation_tourId_fkey" FOREIGN KEY ("tourId")
  REFERENCES public."Tour"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Conversation"
  ADD CONSTRAINT "Conversation_lastMessageSenderId_fkey" FOREIGN KEY ("lastMessageSenderId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Message"
  ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."AiConversation"
  ADD CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- ---- A7. Audit, cấu hình, wishlist, giỏ -----------------------------------------
ALTER TABLE ONLY public."AuditLog"
  ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY public."SystemSetting"
  ADD CONSTRAINT "SystemSetting_updatedById_fkey" FOREIGN KEY ("updatedById")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."WishlistItem"
  ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."WishlistItem"
  ADD CONSTRAINT "WishlistItem_tourId_fkey" FOREIGN KEY ("tourId")
  REFERENCES public."Tour"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."CartItem"
  ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."CartItem"
  ADD CONSTRAINT "CartItem_tourId_fkey" FOREIGN KEY ("tourId")
  REFERENCES public."Tour"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."CartItem"
  ADD CONSTRAINT "CartItem_departureId_fkey" FOREIGN KEY ("departureId")
  REFERENCES public."TourDeparture"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- ============================================================================
-- B. CHECK constraint (35)
--    DB hiện có ĐÚNG 0 CHECK. Mỗi ràng buộc dưới đây chép lại một điều mà
--    validation/policy của code đã chặn; ghi kèm nguồn.
-- ============================================================================

-- ---- Tour: tours.validation.ts (min 1 / min 0), rating 0..5 ----------------------
ALTER TABLE ONLY public."Tour"
  ADD CONSTRAINT "Tour_durationDays_check" CHECK ("durationDays" >= 1);
ALTER TABLE ONLY public."Tour"
  ADD CONSTRAINT "Tour_basePrice_check" CHECK ("basePrice" >= 0);
ALTER TABLE ONLY public."Tour"
  ADD CONSTRAINT "Tour_maxGroupSize_check" CHECK ("maxGroupSize" IS NULL OR "maxGroupSize" >= 1);
ALTER TABLE ONLY public."Tour"
  ADD CONSTRAINT "Tour_ratingAvg_check" CHECK ("ratingAvg" >= 0 AND "ratingAvg" <= 5);
ALTER TABLE ONLY public."Tour"
  ADD CONSTRAINT "Tour_ratingCount_check" CHECK ("ratingCount" >= 0);

-- ---- TourDeparture: departureShape (capacity min 1) + reserveSeats không bán quá chỗ
ALTER TABLE ONLY public."TourDeparture"
  ADD CONSTRAINT "TourDeparture_capacity_check" CHECK ("capacity" >= 1);
ALTER TABLE ONLY public."TourDeparture"
  ADD CONSTRAINT "TourDeparture_remaining_check"
  CHECK ("remaining" >= 0 AND "remaining" <= "capacity");
ALTER TABLE ONLY public."TourDeparture"
  ADD CONSTRAINT "TourDeparture_priceOverride_check"
  CHECK ("priceOverride" IS NULL OR "priceOverride" >= 0);

ALTER TABLE ONLY public."TourGuideAssignment"
  ADD CONSTRAINT "TourGuideAssignment_feePerBooking_check" CHECK ("feePerBooking" >= 0);

-- ---- Booking: bookings.service.ts dòng 95-119 + BOOKING_POLICY -------------------
ALTER TABLE ONLY public."Booking"
  ADD CONSTRAINT "Booking_participants_check" CHECK ("participants" >= 1);
ALTER TABLE ONLY public."Booking"
  ADD CONSTRAINT "Booking_money_check" CHECK (
    "unitPrice" >= 0 AND "subtotal" >= 0 AND "discountAmount" >= 0 AND
    "totalAmount" >= 0 AND "commissionAmount" >= 0 AND "agencyAmount" >= 0);
-- totalAmount = subtotal - discountAmount            (bookings.service.ts:95)
ALTER TABLE ONLY public."Booking"
  ADD CONSTRAINT "Booking_total_check" CHECK ("totalAmount" = "subtotal" - "discountAmount");
-- commissionAmount = floor(totalAmount * bps / 10000); agencyAmount = total - commission
-- (bookings.service.ts:99,119). Ép ::bigint vì totalAmount tới 1e11, nhân 10000 sẽ
-- tràn int4 và làm CHECK ném lỗi thay vì trả false.
ALTER TABLE ONLY public."Booking"
  ADD CONSTRAINT "Booking_commission_check" CHECK (
    "commissionBps" >= 0 AND "commissionBps" <= 10000 AND
    "commissionAmount" = (("totalAmount"::bigint * "commissionBps") / 10000) AND
    "agencyAmount" = "totalAmount" - "commissionAmount");
-- BOOKING_POLICY.MIN_PAYABLE_AMOUNT = 1 (D-74) — CẦN kiểm tra dữ liệu cũ trước khi thêm
ALTER TABLE ONLY public."Booking"
  ADD CONSTRAINT "Booking_amount_min_check" CHECK ("subtotal" >= 1 AND "totalAmount" >= 1);
ALTER TABLE ONLY public."Booking"
  ADD CONSTRAINT "Booking_dates_check" CHECK ("endDate" >= "departureDate");

-- ---- Payment / ETicket / Earning -------------------------------------------------
ALTER TABLE ONLY public."Payment"
  ADD CONSTRAINT "Payment_amount_check" CHECK ("amount" >= 1);
ALTER TABLE ONLY public."ETicket"
  ADD CONSTRAINT "ETicket_participants_check" CHECK ("participants" >= 1);
ALTER TABLE ONLY public."Earning"
  ADD CONSTRAINT "Earning_amount_check" CHECK ("amount" >= 0);

-- ---- Review: reviews.validation.ts (rating 1..5) ---------------------------------
ALTER TABLE ONLY public."Review"
  ADD CONSTRAINT "Review_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5);

-- ---- Promotion: promotions.validation.ts + consume() nguyên tử -------------------
ALTER TABLE ONLY public."Promotion"
  ADD CONSTRAINT "Promotion_discountValue_check" CHECK ("discountValue" >= 1);
ALTER TABLE ONLY public."Promotion"
  ADD CONSTRAINT "Promotion_percent_check"
  CHECK ("discountType" <> 'PERCENT' OR "discountValue" <= 100);
ALTER TABLE ONLY public."Promotion"
  ADD CONSTRAINT "Promotion_minOrderAmount_check" CHECK ("minOrderAmount" >= 0);
ALTER TABLE ONLY public."Promotion"
  ADD CONSTRAINT "Promotion_maxDiscountAmount_check"
  CHECK ("maxDiscountAmount" IS NULL OR "maxDiscountAmount" >= 0);
-- consume(): WHERE usageLimit IS NULL OR usedCount < usageLimit -> luôn <=
ALTER TABLE ONLY public."Promotion"
  ADD CONSTRAINT "Promotion_usage_check"
  CHECK ("usedCount" >= 0 AND ("usageLimit" IS NULL OR "usedCount" <= "usageLimit"));
ALTER TABLE ONLY public."Promotion"
  ADD CONSTRAINT "Promotion_dates_check" CHECK ("endsAt" > "startsAt");

-- ---- Subscription / SupportTicket / Conversation / Ai ---------------------------
ALTER TABLE ONLY public."SubscriptionPlan"
  ADD CONSTRAINT "SubscriptionPlan_price_check" CHECK ("price" >= 0);
ALTER TABLE ONLY public."SubscriptionPlan"
  ADD CONSTRAINT "SubscriptionPlan_durationDays_check" CHECK ("durationDays" >= 1);
ALTER TABLE ONLY public."Subscription"
  ADD CONSTRAINT "Subscription_price_check" CHECK ("price" >= 0);
ALTER TABLE ONLY public."Subscription"
  ADD CONSTRAINT "Subscription_durationDays_check" CHECK ("durationDays" >= 1);
ALTER TABLE ONLY public."Subscription"
  ADD CONSTRAINT "Subscription_period_check"
  CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt");
ALTER TABLE ONLY public."SupportTicket"
  ADD CONSTRAINT "SupportTicket_messageCount_check" CHECK ("messageCount" >= 0);
ALTER TABLE ONLY public."Conversation"
  ADD CONSTRAINT "Conversation_unread_check"
  CHECK ("unreadTraveler" >= 0 AND "unreadGuide" >= 0);
ALTER TABLE ONLY public."AiConversation"
  ADD CONSTRAINT "AiConversation_messageCount_check" CHECK ("messageCount" >= 0);

-- ---- OTP / giỏ -------------------------------------------------------------------
ALTER TABLE ONLY public."Otp"
  ADD CONSTRAINT "Otp_attempts_check" CHECK ("attempts" >= 0);
ALTER TABLE ONLY public."Otp"
  ADD CONSTRAINT "Otp_expiry_check" CHECK ("expiresAt" > "issuedAt");
-- carts.validation.ts: 1..BOOKING_POLICY.MAX_PARTICIPANTS (50)
ALTER TABLE ONLY public."CartItem"
  ADD CONSTRAINT "CartItem_participants_check"
  CHECK ("participants" >= 1 AND "participants" <= 50);

-- ============================================================================
-- C. INDEX cho cột khoá ngoại (26)
--    PostgreSQL KHÔNG tự đánh index cho FK. 26 cột dưới đây sẽ trở thành cột FK
--    nhưng không có index nào lấy chúng làm cột đầu, nên mỗi lần xoá/sửa dòng cha
--    là một lần quét toàn bảng con.
--
--    Ghi chú: 7 index đánh dấu [ghi công] chỉ phục vụ cột "ai làm việc này"
--    (User không bao giờ bị xoá cứng) — bỏ được nếu sau này cần giảm chi phí ghi.
-- ============================================================================

CREATE INDEX "Subscription_planId_idx" ON public."Subscription" ("planId");
CREATE INDEX "User_bannedById_idx" ON public."User" ("bannedById");

CREATE INDEX "Tour_reviewedById_idx" ON public."Tour" ("reviewedById");            -- [ghi công]
CREATE INDEX "Booking_departureId_idx" ON public."Booking" ("departureId");
CREATE INDEX "Booking_promotionId_idx" ON public."Booking" ("promotionId");
CREATE INDEX "ETicket_agencyId_idx" ON public."ETicket" ("agencyId");
CREATE INDEX "ETicket_tourId_idx" ON public."ETicket" ("tourId");
CREATE INDEX "Earning_agencyId_idx" ON public."Earning" ("agencyId");
CREATE INDEX "Earning_tourId_idx" ON public."Earning" ("tourId");
CREATE INDEX "Review_moderatedById_idx" ON public."Review" ("moderatedById");       -- [ghi công]
CREATE INDEX "Report_bookingId_idx" ON public."Report" ("bookingId");
CREATE INDEX "Report_tourId_idx" ON public."Report" ("tourId");
CREATE INDEX "Report_agencyResponseById_idx" ON public."Report" ("agencyResponseById"); -- [ghi công]
CREATE INDEX "Report_resolutionById_idx" ON public."Report" ("resolutionById");     -- [ghi công]
CREATE INDEX "Promotion_ownerId_idx" ON public."Promotion" ("ownerId");
CREATE INDEX "Promotion_createdById_idx" ON public."Promotion" ("createdById");     -- [ghi công]
CREATE INDEX "SupportTicket_bookingId_idx" ON public."SupportTicket" ("bookingId");
CREATE INDEX "SupportTicket_assignedToId_idx" ON public."SupportTicket" ("assignedToId");
CREATE INDEX "SupportTicketMessage_authorId_idx" ON public."SupportTicketMessage" ("authorId"); -- [ghi công]
CREATE INDEX "Conversation_tourId_idx" ON public."Conversation" ("tourId");
CREATE INDEX "Conversation_lastMessageSenderId_idx"
  ON public."Conversation" ("lastMessageSenderId");                                 -- [ghi công]
CREATE INDEX "Message_senderId_idx" ON public."Message" ("senderId");
CREATE INDEX "SystemSetting_updatedById_idx" ON public."SystemSetting" ("updatedById");
CREATE INDEX "WishlistItem_tourId_idx" ON public."WishlistItem" ("tourId");
CREATE INDEX "CartItem_tourId_idx" ON public."CartItem" ("tourId");
CREATE INDEX "CartItem_departureId_idx" ON public."CartItem" ("departureId");

-- ============================================================================
-- D. NOT NULL cho mảng text (7)
--    Prisma khai `String[] @default([])` nhưng cột text[] vẫn NULLable, nên DB cho
--    phép NULL ở đúng những chỗ code luôn coi là mảng.
-- ============================================================================

ALTER TABLE ONLY public."User"
  ALTER COLUMN "extraPermissions" SET DEFAULT '{}', ALTER COLUMN "extraPermissions" SET NOT NULL;
ALTER TABLE ONLY public."Tour"
  ALTER COLUMN "images" SET DEFAULT '{}', ALTER COLUMN "images" SET NOT NULL;
ALTER TABLE ONLY public."Tour"
  ALTER COLUMN "inclusions" SET DEFAULT '{}', ALTER COLUMN "inclusions" SET NOT NULL;
ALTER TABLE ONLY public."Tour"
  ALTER COLUMN "exclusions" SET DEFAULT '{}', ALTER COLUMN "exclusions" SET NOT NULL;
ALTER TABLE ONLY public."GuideProfile"
  ALTER COLUMN "languages" SET DEFAULT '{}', ALTER COLUMN "languages" SET NOT NULL;
ALTER TABLE ONLY public."GuideProfile"
  ALTER COLUMN "specialties" SET DEFAULT '{}', ALTER COLUMN "specialties" SET NOT NULL;
ALTER TABLE ONLY public."SubscriptionPlan"
  ALTER COLUMN "benefits" SET DEFAULT '{}', ALTER COLUMN "benefits" SET NOT NULL;

-- ============================================================================
-- E. TRIGGER updatedAt (16 bảng)
--    `@updatedAt` của Prisma chỉ chạy khi ghi qua Prisma client. Sửa trực tiếp
--    bằng SQL (script vận hành, psql, migration) sẽ để lại updatedAt sai.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "User_updatedAt" BEFORE UPDATE ON public."User"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "Tour_updatedAt" BEFORE UPDATE ON public."Tour"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "Booking_updatedAt" BEFORE UPDATE ON public."Booking"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "Payment_updatedAt" BEFORE UPDATE ON public."Payment"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "ETicket_updatedAt" BEFORE UPDATE ON public."ETicket"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "Review_updatedAt" BEFORE UPDATE ON public."Review"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "Report_updatedAt" BEFORE UPDATE ON public."Report"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "Promotion_updatedAt" BEFORE UPDATE ON public."Promotion"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "SubscriptionPlan_updatedAt" BEFORE UPDATE ON public."SubscriptionPlan"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "Subscription_updatedAt" BEFORE UPDATE ON public."Subscription"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "SupportTicket_updatedAt" BEFORE UPDATE ON public."SupportTicket"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "Conversation_updatedAt" BEFORE UPDATE ON public."Conversation"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "AiConversation_updatedAt" BEFORE UPDATE ON public."AiConversation"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "SystemSetting_updatedAt" BEFORE UPDATE ON public."SystemSetting"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "CartItem_updatedAt" BEFORE UPDATE ON public."CartItem"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER "Category_updatedAt" BEFORE UPDATE ON public."Category"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
