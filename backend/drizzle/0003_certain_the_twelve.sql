ALTER TABLE "transactions" ADD COLUMN "dedup_ref_hash" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_dedup_ref_hash_idx" ON "transactions" USING btree ("dedup_ref_hash");