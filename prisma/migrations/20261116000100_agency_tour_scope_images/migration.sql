-- A member can be delegated a tour's images as well as its text.
ALTER TABLE "AgencyMemberTourScope" DROP CONSTRAINT "AgencyMemberTourScope_fields_check";
ALTER TABLE "AgencyMemberTourScope" ADD CONSTRAINT "AgencyMemberTourScope_fields_check"
  CHECK ("allowedFields" <@ ARRAY['title','summary','description','images']::TEXT[]);
