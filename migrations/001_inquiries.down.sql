-- Reverses 001_inquiries.up.sql. Destroys every inquiry; the migrate script
-- requires an explicit confirmation flag.
DROP TABLE IF EXISTS admin_sessions;
DROP TABLE IF EXISTS used_proofs;
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS inquiry_events;
DROP TABLE IF EXISTS inquiries;
