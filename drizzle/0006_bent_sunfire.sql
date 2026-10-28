CREATE TABLE "damage_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"damage_number" text NOT NULL,
	"source_location_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'quarantined' NOT NULL,
	"resolution_notes" text,
	"resolution_location_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"reported_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "damage_reports_damage_number_unique" UNIQUE("damage_number"),
	CONSTRAINT "damage_reports_quantity_positive" CHECK ("damage_reports"."quantity" > 0),
	CONSTRAINT "damage_reports_reason_not_blank" CHECK (length(trim("damage_reports"."reason")) > 0),
	CONSTRAINT "damage_reports_status_valid" CHECK ("damage_reports"."status" in ('quarantined', 'repaired', 'disposed'))
);
--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_source_location_id_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_resolution_location_id_locations_id_fk" FOREIGN KEY ("resolution_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_reported_by_profiles_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "damage_reports_source_idx" ON "damage_reports" USING btree ("source_location_id");--> statement-breakpoint
CREATE INDEX "damage_reports_variant_idx" ON "damage_reports" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "damage_reports_status_idx" ON "damage_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "damage_reports_created_at_idx" ON "damage_reports" USING btree ("created_at");--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS damage_number_seq START 1001;