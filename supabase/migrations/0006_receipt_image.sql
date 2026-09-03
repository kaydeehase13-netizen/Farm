-- The receipt table had no column to actually hold the photo — only OCR
-- guess fields (vendor/date/amount) were ever saved. Every receipt image
-- uploaded before this migration was discarded after OCR ran; there is no
-- copy anywhere to recover, since it never reached the database at all.
--
-- Add a column to store the (downscaled, client-side-compressed) photo as a
-- base64 data URL, matching what demo mode already does. Safe to run more
-- than once.
alter table receipt add column if not exists file_data_url text;
