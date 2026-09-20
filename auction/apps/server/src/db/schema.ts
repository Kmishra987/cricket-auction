import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";

export const auctionStatus = pgEnum("auction_status", ["DRAFT", "CONFIGURED", "SCHEDULED", "LIVE", "PAUSED", "COMPLETED"]);
export const playerStatus = pgEnum("player_status", ["PENDING", "CURRENT", "SOLD", "UNSOLD"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tournaments = pgTable("tournaments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizerId: uuid("organizer_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  timezone: text("timezone").default("UTC").notNull(),
  numberOfTeams: integer("number_of_teams"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  captainId: uuid("captain_id").references(() => users.id),
  name: text("name").notNull(),
  logo: text("logo").notNull(),
  logoConfig: jsonb("logo_config").$type<{ icon: string; primaryColor: string; secondaryColor: string; shape: string }>().notNull(),
  spentPurse: integer("spent_purse").default(0).notNull(),
  remainingPurse: integer("remaining_purse").default(0).notNull(),
  squadCount: integer("squad_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tournamentName: uniqueIndex("teams_tournament_name_idx").on(table.tournamentId, table.name),
}));

export const tiers = pgTable("tiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").default(0).notNull(),
}, (table) => ({
  tournamentName: uniqueIndex("tiers_tournament_name_idx").on(table.tournamentId, table.name),
}));

export const auctions = pgTable("auctions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
  status: auctionStatus("status").default("DRAFT").notNull(),
  squadSize: integer("squad_size").notNull(),
  pursePerTeam: integer("purse_per_team").notNull(),
  basePrice: integer("base_price").notNull(),
  incrementOne: integer("increment_one").notNull(),
  incrementTwo: integer("increment_two").notNull(),
  incrementThree: integer("increment_three").notNull(),
  timerEnabled: boolean("timer_enabled").default(false).notNull(),
  timerDurationSeconds: integer("timer_duration_seconds"),
  tierSystemEnabled: boolean("tier_system_enabled").default(false).notNull(),
  orderingStrategy: text("ordering_strategy").default("sequential").notNull(),
  currentPlayerId: uuid("current_player_id"),
  currentBid: integer("current_bid").default(0).notNull(),
  highestBidderTeamId: uuid("highest_bidder_team_id"),
  bidCount: integer("bid_count").default(0).notNull(),
  timerEndsAt: timestamp("timer_ends_at", { withTimezone: true }),
  timerRemainingSeconds: integer("timer_remaining_seconds"),
  eventSequence: integer("event_sequence").default(0).notNull(),
  configurationLocked: boolean("configuration_locked").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").notNull().references(() => tournaments.id),
  tierId: uuid("tier_id").references(() => tiers.id),
  name: text("name").notNull(),
  role: text("role").notNull(),
  photo: text("photo"),
  age: integer("age"),
  battingStyle: text("batting_style"),
  bowlingStyle: text("bowling_style"),
  isForeign: boolean("is_foreign").default(false).notNull(),
  bio: text("bio"),
  stats: jsonb("stats").$type<Record<string, number>>(),
  status: playerStatus("status").default("PENDING").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auctionPlayers = pgTable("auction_players", {
  id: uuid("id").defaultRandom().primaryKey(),
  auctionId: uuid("auction_id").notNull().references(() => auctions.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").notNull().references(() => players.id),
  orderIndex: integer("order_index").notNull(),
  status: playerStatus("status").default("PENDING").notNull(),
  soldToTeamId: uuid("sold_to_team_id").references(() => teams.id),
  salePrice: integer("sale_price"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  auctionPlayer: uniqueIndex("auction_players_auction_player_idx").on(table.auctionId, table.playerId),
  auctionOrder: uniqueIndex("auction_players_auction_order_idx").on(table.auctionId, table.orderIndex),
}));

export const bids = pgTable("bids", {
  id: uuid("id").defaultRandom().primaryKey(),
  auctionId: uuid("auction_id").notNull().references(() => auctions.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").notNull().references(() => players.id),
  teamId: uuid("team_id").notNull().references(() => teams.id),
  captainId: uuid("captain_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  increment: integer("increment").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auctionControls = pgTable("auction_controls", {
  auctionId: uuid("auction_id").primaryKey().references(() => auctions.id, { onDelete: "cascade" }),
  controllerUserId: uuid("controller_user_id").notNull().references(() => users.id),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auctioneers = pgTable("auctioneers", {
  auctionId: uuid("auction_id").notNull().references(() => auctions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  auctionUser: uniqueIndex("auctioneers_auction_user_idx").on(table.auctionId, table.userId),
}));

export const auctionEvents = pgTable("auction_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  auctionId: uuid("auction_id").notNull().references(() => auctions.id),
  eventType: text("event_type").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  sequenceNumber: integer("sequence_number").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  auctionSequence: uniqueIndex("auction_events_sequence_idx").on(table.auctionId, table.sequenceNumber),
}));
