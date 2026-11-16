-- Old application workers may still share this database. Elapsed time alone
-- must not complete a booking: the Agency must submit a report in the same transaction.
-- Existing completed records and inserts used to import history are left unchanged.
CREATE FUNCTION require_agency_report_for_booking_completion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'COMPLETED' AND NEW.status = 'COMPLETED' AND NOT EXISTS (
    SELECT 1 FROM "TourCompletion" c
    JOIN "TourCompletionReport" r ON r."completionId" = c.id AND r.submitted
    WHERE c."departureId" = NEW."departureId" AND c."tourId" = NEW."tourId" AND c."agencyId" = NEW."agencyId"
      AND r.payload->'attendance' @> jsonb_build_array(jsonb_build_object('bookingId', NEW.id::text))
  ) THEN
    RAISE EXCEPTION 'AGENCY_COMPLETION_REQUIRED: submit an Agency completion report first'
      USING ERRCODE = '23514', CONSTRAINT = 'Booking_completion_requires_agency_report';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Booking_completion_requires_agency_report"
BEFORE UPDATE OF status ON "Booking"
FOR EACH ROW EXECUTE FUNCTION require_agency_report_for_booking_completion();
