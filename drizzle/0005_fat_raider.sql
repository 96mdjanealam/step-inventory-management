CREATE TABLE "return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"sale_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_refund_price" numeric(14, 2) NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	CONSTRAINT "return_items_quantity_positive" CHECK ("return_items"."quantity" > 0),
	CONSTRAINT "return_items_unit_refund_price_non_negative" CHECK ("return_items"."unit_refund_price" >= 0),
	CONSTRAINT "return_items_subtotal_non_negative" CHECK ("return_items"."subtotal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_number" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"total_refund_amount" numeric(14, 2) NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "returns_return_number_unique" UNIQUE("return_number"),
	CONSTRAINT "returns_total_refund_non_negative" CHECK ("returns"."total_refund_amount" >= 0),
	CONSTRAINT "returns_reason_not_blank" CHECK (length(trim("returns"."reason")) > 0)
);
--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_sale_item_id_sale_items_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "return_items_return_idx" ON "return_items" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "return_items_sale_item_idx" ON "return_items" USING btree ("sale_item_id");--> statement-breakpoint
CREATE INDEX "return_items_variant_idx" ON "return_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "returns_sale_idx" ON "returns" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "returns_location_idx" ON "returns" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "returns_return_number_idx" ON "returns" USING btree ("return_number");--> statement-breakpoint
CREATE INDEX "returns_created_at_idx" ON "returns" USING btree ("created_at");--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS return_number_seq START 1001;