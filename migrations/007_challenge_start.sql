-- The Northern Challenge opened Thu Nov 26, 2026, 9:00 PM America/New_York.
-- The end stays Sun Dec 6, 2026, 11:59 PM ET. One timestamp update, no deletes.

UPDATE challenges
SET starts_at = '2026-11-27T02:00:00Z'
WHERE slug = 'northern';
