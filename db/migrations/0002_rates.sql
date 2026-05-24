-- Add travel day count and an optional manual rate override to galleries.
-- Rate calculation otherwise comes from package_type + hours_shot + travel_days.

ALTER TABLE galleries ADD COLUMN travel_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE galleries ADD COLUMN rate_override_cents INTEGER;
