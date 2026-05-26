-- Add finer-grained geo to analytics events. country was already populated
-- from CF-IPCountry; city + region come from request.cf on the Worker.

ALTER TABLE download_events ADD COLUMN city TEXT;
ALTER TABLE download_events ADD COLUMN region TEXT;
