CREATE TABLE "auction_controls" (
	"auction_id" uuid PRIMARY KEY NOT NULL,
	"controller_user_id" uuid NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"status" "player_status" DEFAULT 'PENDING' NOT NULL,
	"sold_to_team_id" uuid,
	"sale_price" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"captain_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"increment" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auctions" ADD COLUMN "ordering_strategy" text DEFAULT 'sequential' NOT NULL;--> statement-breakpoint
ALTER TABLE "auctions" ADD COLUMN "current_player_id" uuid;--> statement-breakpoint
ALTER TABLE "auctions" ADD COLUMN "current_bid" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "auctions" ADD COLUMN "highest_bidder_team_id" uuid;--> statement-breakpoint
ALTER TABLE "auctions" ADD COLUMN "bid_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "auctions" ADD COLUMN "timer_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auctions" ADD COLUMN "event_sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "spent_purse" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "remaining_purse" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "squad_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "auction_controls" ADD CONSTRAINT "auction_controls_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_controls" ADD CONSTRAINT "auction_controls_controller_user_id_users_id_fk" FOREIGN KEY ("controller_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_players" ADD CONSTRAINT "auction_players_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_players" ADD CONSTRAINT "auction_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_players" ADD CONSTRAINT "auction_players_sold_to_team_id_teams_id_fk" FOREIGN KEY ("sold_to_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_captain_id_users_id_fk" FOREIGN KEY ("captain_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auction_players_auction_player_idx" ON "auction_players" USING btree ("auction_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_players_auction_order_idx" ON "auction_players" USING btree ("auction_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_events_sequence_idx" ON "auction_events" USING btree ("auction_id","sequence_number");