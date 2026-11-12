-- Forward-only TEST CANDIDATE. Keep the useful calendar index present on Neon
-- and make fresh history converge, without editing the original migrations.
CREATE INDEX IF NOT EXISTS "TourDeparture_tourId_date_idx"
  ON "TourDeparture"("tourId", "date");
