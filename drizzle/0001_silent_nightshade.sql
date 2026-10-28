CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"target_consumer" text DEFAULT 'unisex' NOT NULL,
	"measurement_type" text DEFAULT 'count' NOT NULL,
	"unit" text DEFAULT 'piece' NOT NULL,
	"images" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_target_consumer_valid" CHECK ("products"."target_consumer" in ('male', 'female', 'unisex', 'kids')),
	CONSTRAINT "products_measurement_type_valid" CHECK ("products"."measurement_type" in ('count', 'weight', 'volume')),
	CONSTRAINT "products_name_not_blank" CHECK (length(trim("products"."name")) > 0),
	CONSTRAINT "products_category_not_blank" CHECK (length(trim("products"."category")) > 0),
	CONSTRAINT "products_slug_format" CHECK ("products"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "products_unit_matches_measurement" CHECK (("products"."measurement_type" = 'count' and "products"."unit" = 'piece') or ("products"."measurement_type" = 'weight' and "products"."unit" in ('kg', 'g')) or ("products"."measurement_type" = 'volume' and "products"."unit" in ('litre', 'ml')))
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image" text,
	"discounted_price" numeric(14, 2) NOT NULL,
	"regular_price" numeric(14, 2),
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variants_attributes_is_object" CHECK (jsonb_typeof("product_variants"."attributes") = 'object'),
	CONSTRAINT "variants_discounted_price_non_negative" CHECK ("product_variants"."discounted_price" >= 0),
	CONSTRAINT "variants_regular_price_non_negative" CHECK ("product_variants"."regular_price" is null or "product_variants"."regular_price" >= 0),
	CONSTRAINT "variants_regular_not_below_discounted" CHECK ("product_variants"."regular_price" is null or "product_variants"."regular_price" >= "product_variants"."discounted_price")
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree (lower("category"));--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_sku_unique" ON "product_variants" USING btree ("sku") WHERE "product_variants"."sku" is not null and length(trim("product_variants"."sku")) > 0;--> statement-breakpoint
CREATE UNIQUE INDEX "one_default_variant_per_product" ON "product_variants" USING btree ("product_id") WHERE "product_variants"."is_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_unique_attributes" ON "product_variants" USING btree ("product_id","attributes") WHERE "product_variants"."is_active" = true;--> statement-breakpoint
CREATE INDEX "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");