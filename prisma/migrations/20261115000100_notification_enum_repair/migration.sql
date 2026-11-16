-- Some development databases have the custom-tour tables but an older notification enum.
-- Keep notification visibility queries compatible without rebuilding existing tables.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ADMIN_REQUEST_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AGENCY_COMMISSION_DECIDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CUSTOM_TOUR_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CUSTOM_TOUR_DECIDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CUSTOM_TOUR_OFFERED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CUSTOM_TOUR_ACCEPTED';
