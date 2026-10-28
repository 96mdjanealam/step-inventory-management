CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"description" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_location_id" uuid,
	"destination_location_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_logs_action_not_blank" CHECK (length(trim("activity_logs"."action")) > 0),
	CONSTRAINT "activity_logs_description_not_blank" CHECK (length(trim("activity_logs"."description")) > 0),
	CONSTRAINT "activity_logs_metadata_is_object" CHECK (jsonb_typeof("activity_logs"."metadata") = 'object')
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_source_location_id_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_destination_location_id_locations_id_fk" FOREIGN KEY ("destination_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_logs_action_idx" ON "activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "activity_logs_source_location_idx" ON "activity_logs" USING btree ("source_location_id");--> statement-breakpoint
CREATE INDEX "activity_logs_dest_location_idx" ON "activity_logs" USING btree ("destination_location_id");--> statement-breakpoint
CREATE INDEX "activity_logs_entity_idx" ON "activity_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_activity_logs_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs entries cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER activity_logs_append_only
BEFORE UPDATE OR DELETE ON "activity_logs"
FOR EACH ROW
EXECUTE FUNCTION prevent_activity_logs_modification();
