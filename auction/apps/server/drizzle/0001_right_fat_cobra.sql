CREATE TABLE "tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "tier_id" uuid;--> statement-breakpoint
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tiers_tournament_name_idx" ON "tiers" USING btree ("tournament_id","name");--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_tier_id_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id") ON DELETE no action ON UPDATE no action;