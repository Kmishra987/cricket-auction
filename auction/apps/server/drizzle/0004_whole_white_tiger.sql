ALTER TABLE "auctions" ADD COLUMN "tier_system_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "number_of_teams" integer;