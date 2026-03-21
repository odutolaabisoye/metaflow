-- AddColumn: Connection.webhookSecret (nullable, encrypted)
-- Used to verify HMAC signatures on incoming WooCommerce webhook payloads.
ALTER TABLE "Connection" ADD COLUMN "webhookSecret" TEXT;
