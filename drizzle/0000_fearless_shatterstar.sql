CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"store_type" text,
	"address" text,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_type_valid" CHECK ("locations"."type" in ('warehouse', 'store', 'damaged')),
	CONSTRAINT "locations_store_type_valid" CHECK ("locations"."store_type" is null or "locations"."store_type" in ('ownstore', 'franchise')),
	CONSTRAINT "locations_name_not_blank" CHECK (length(trim("locations"."name")) > 0),
	CONSTRAINT "locations_store_type_matches_type" CHECK (("locations"."type" = 'store' and "locations"."store_type" is not null) or ("locations"."type" <> 'store' and "locations"."store_type" is null))
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text,
	"role" text DEFAULT 'employee' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_role_valid" CHECK ("profiles"."role" in ('admin', 'employee')),
	CONSTRAINT "profiles_username_not_blank" CHECK ("profiles"."username" is null or length(trim("profiles"."username")) > 0)
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_main_warehouse" ON "locations" USING btree ("type") WHERE "locations"."type" = 'warehouse';--> statement-breakpoint
CREATE UNIQUE INDEX "one_central_damaged_location" ON "locations" USING btree ("type") WHERE "locations"."type" = 'damaged';--> statement-breakpoint
CREATE UNIQUE INDEX "locations_name_unique" ON "locations" USING btree (lower(trim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_lower_unique" ON "profiles" USING btree (lower("username")) WHERE "profiles"."username" is not null;