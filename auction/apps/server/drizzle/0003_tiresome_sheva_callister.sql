CREATE TABLE "auctioneers" (
	"auction_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auctions" ADD COLUMN "timer_remaining_seconds" integer;--> statement-breakpoint
ALTER TABLE "auctioneers" ADD CONSTRAINT "auctioneers_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctioneers" ADD CONSTRAINT "auctioneers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auctioneers_auction_user_idx" ON "auctioneers" USING btree ("auction_id","user_id");