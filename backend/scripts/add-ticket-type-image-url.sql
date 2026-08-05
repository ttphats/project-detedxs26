-- Add card image for ticket types (optional).
-- When NULL, web-client falls back to CSS gradient ticket card.
-- Safe to re-run: checks information_schema first is handled by app ensure helper.

ALTER TABLE ticket_types
  ADD COLUMN image_url VARCHAR(500) NULL DEFAULT NULL
  AFTER icon;
