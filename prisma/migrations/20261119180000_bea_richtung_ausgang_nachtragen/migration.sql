-- Backfill: messages sent before the "richtung" column existed got the default
-- 'EINGANG'. Sent messages carry gesendetAm or status GESENDET.
UPDATE "bea_nachrichten" SET "richtung" = 'AUSGANG' WHERE "gesendetAm" IS NOT NULL OR "status" = 'GESENDET';
