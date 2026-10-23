ALTER TABLE "leads" ADD COLUMN "ghl_contact_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "ghl_opportunity_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "leads_ghl_contact_id_idx" ON "leads" USING btree ("ghl_contact_id");--> statement-breakpoint
CREATE INDEX "leads_ghl_opportunity_id_idx" ON "leads" USING btree ("ghl_opportunity_id");