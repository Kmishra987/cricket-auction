export type AuctionStatus = "DRAFT" | "CONFIGURED" | "SCHEDULED" | "LIVE" | "PAUSED" | "COMPLETED";
export type PlayerStatus = "PENDING" | "CURRENT" | "SOLD" | "UNSOLD";

export type TeamSummary = {
  id: string;
  name: string;
  logo: string;
  accent: string;
  remainingPurse: number;
  spentPurse: number;
  squadCount: number;
};

export type AuctionSnapshot = {
  type: "AUCTION_STATE";
  sequence: number;
  status: AuctionStatus;
  currentPlayer: {
    id: string;
    name: string;
    role: string;
    tier?: string;
    isForeign: boolean;
    basePrice: number;
    currentBid: number;
    highestTeamId?: string;
    bidCount: number;
  } | null;
  teams: TeamSummary[];
};

export type AuctionEvent = {
  type: "BID_PLACED" | "PLAYER_SOLD" | "PLAYER_UNSOLD" | "AUCTION_PAUSED" | "AUCTION_RESUMED";
  sequence: number;
  payload: Record<string, unknown>;
};
