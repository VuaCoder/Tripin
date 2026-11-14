ALTER TABLE "Tour" ADD COLUMN "optionalServices" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Booking" ADD COLUMN "serviceSnapshot" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "servicesSubtotal" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "meetingPointSnapshot" TEXT,
  ADD COLUMN "requestFingerprint" TEXT;
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_optionalServices_array" CHECK (jsonb_typeof("optionalServices") = 'array');
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceSnapshot_array" CHECK (jsonb_typeof("serviceSnapshot") = 'array'),
  ADD CONSTRAINT "Booking_servicesSubtotal_nonnegative" CHECK ("servicesSubtotal" >= 0);
