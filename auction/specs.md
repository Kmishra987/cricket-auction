# Cricket Auction Platform — Codex Implementation Specification

## 1. Objective

Build a production-quality web application for conducting **live cricket team/player auctions**.

The platform allows a registered user to create a tournament/auction, configure teams and captains, add player profiles, schedule and conduct a real-time auction, allow only authorized captains to bid, provide a public spectator link, maintain a complete event history, and generate a final PDF containing team-wise results.

The application must be designed around a **server-authoritative, event-driven auction engine** with WebSocket-based realtime updates.

Do not build this as a collection of loosely connected CRUD screens. The auction engine and its state transitions are the core domain of the application.

---

# 2. Core Product Model

The hierarchy is:

```text
User
 └── Tournament
      ├── Organizer
      ├── Captains
      │    └── Teams
      ├── Auction Configuration
      ├── Players
      ├── Auction Session
      ├── Auction Events
      └── Final Results
```

A user can participate in multiple tournaments.

A tournament has exactly one organizer.

A registered user may be assigned as a captain by the organizer.

A captain is associated with exactly one team within a particular tournament.

Players do NOT need accounts in V1. Players are created and managed by the organizer.

---

# 3. Recommended Technology

Use a modern, maintainable stack.

## Frontend

* Next.js
* TypeScript
* React
* Tailwind CSS
* shadcn/ui or equivalent accessible component system
* TanStack Query where appropriate
* WebSocket client for auction realtime updates

## Backend

Use:

* Python
* FastAPI
* Pydantic
* SQLAlchemy 2.x
* PostgreSQL
* Redis for realtime/pub-sub and distributed coordination where useful
* WebSockets

## Infrastructure

Provide:

* Docker
* Docker Compose for local development
* PostgreSQL
* Redis

Use environment variables for configuration.

Do not hardcode secrets, database URLs, JWT secrets, etc.

---

# 4. Authentication

Implement registered users.

A user needs:

```text
id
username
email
password_hash
display_name
avatar
created_at
updated_at
```

Username must be unique.

Authentication must be secure.

Never store plaintext passwords.

Use secure password hashing.

The frontend must not be trusted for authorization.

The backend determines the authenticated user's role and permissions for every protected action.

A user can participate in many tournaments.

---

# 5. Roles

There are three primary application roles within an auction.

## Organizer

The tournament creator.

Organizer permissions include:

* Create tournament
* Configure tournament
* Add/edit/delete players
* Import players using JSON
* Configure teams
* Assign captains
* Add auctioneers
* Schedule auction
* Start auction
* Pause/resume auction
* Select next player
* Sell player
* Mark player unsold
* Re-auction player
* Undo supported auction actions
* View complete event history
* Generate final PDF
* Duplicate auction

## Captain

A registered user assigned to a team by the organizer.

Captain can:

* View live auction
* View all players
* View all teams
* View team purse
* View own squad
* Place bids for their assigned team

Captain cannot:

* Modify configuration
* Modify players
* Start auction
* Sell player
* Mark unsold
* Change purse
* Change teams
* Modify auction order
* Control auction state

## Viewer

Unauthenticated or authenticated spectator.

Viewer can access the public live auction page and see:

* Current player
* Current bid
* Current highest-bidding team
* All teams
* Team logos
* Team squads
* Purse information
* Sold players
* Unsold players
* Upcoming players
* Player statistics
* Auction history

Viewer must never receive bidding controls.

---

# 6. Organizer

The user who creates a tournament automatically becomes its organizer.

A tournament must have:

```text
organizer_id
```

Only the organizer can modify tournament configuration before auction start.

---

# 7. Auctioneers

The organizer may add other registered users as auctioneers.

The organizer remains an administrator.

At any given time, only ONE auctioneer may control the live auction.

Implement a server-side auction-control lock.

Example:

```text
Auctioneer A acquires control
        ↓
control_lock = A
        ↓
Auctioneer B opens auction
        ↓
B sees read-only auction
```

B must not be able to:

* Start
* Pause
* Resume
* Select player
* Sell
* Unsell
* Re-auction
* Perform other auction-control actions

even if B manually calls the backend API.

Authorization must be checked server-side.

Do NOT automatically transfer control if the active auctioneer disconnects.

The lock must remain until explicitly released/reassigned through an authorized mechanism.

Implement:

```text
acquire_control
release_control
```

with atomic server-side locking.

Use database/Redis mechanisms where appropriate to prevent race conditions.

---

# 8. Tournament Creation

Organizer creates:

```text
Tournament name
Description
Start date
Auction date
Auction time
Timezone
Number of teams
Squad size
Total purse per team
Global base price
Bid increment 1
Bid increment 2
Bid increment 3
Auction timer enabled/disabled
Timer duration if enabled
Tier system enabled/disabled
Auction ordering strategy
```

Team names are assigned by the organizer.

---

# 9. Team Configuration

For each team:

```text
team_id
tournament_id
name
captain_id
logo
logo_configuration
created_at
```

The organizer creates the team names.

Captains are selected from registered users.

Example:

```text
Thunderbolts → @rahul
Warriors     → @virat
Titans       → @rohit
Mavericks    → @bumrah
```

A captain can only bid for their assigned team.

---

# 10. Team Logo System

Do not make AI image generation a requirement for V1.

Build a deterministic logo generator.

Allow organizer to configure:

* Icon/emoji
* Primary color
* Secondary color
* Shape/style

Generate a minimal SVG-based team logo.

Examples:

```text
⚡ Thunderbolts
🔥 Warriors
🐯 Tigers
🚀 Strikers
```

The logo should look polished and suitable for:

* Team cards
* Auction screen
* Mobile UI
* PDF
* Public sharing

Keep the visual system colorful but minimal.

Support both light and dark UI themes.

---

# 11. Player Model

Players are organizer-managed entities.

A player should support:

```text
id
tournament_id
name
photo
age
role
batting_style
bowling_style
is_foreign
bio
stats
tier_id
created_at
updated_at
```

Stats should be flexible enough to support structured cricket statistics without forcing every tournament to have exactly the same fields.

At minimum support common values such as:

```text
matches
runs
batting_average
strike_rate
wickets
bowling_average
economy
catches
```

Allow missing statistics.

Do not fabricate stats.

---

# 12. Foreign Player

Player has:

```text
is_foreign: boolean
```

When true, show a small flight icon:

```text
✈
```

next to the player wherever the player is prominently displayed.

The icon should be subtle rather than visually dominant.

---

# 13. Player Creation

Support two methods.

## Manual creation

Organizer fills a player form.

The form must validate:

* Name required
* Age valid
* Role valid
* Stats valid
* Tier valid if tiers are enabled

## JSON import

Organizer can paste JSON.

Example:

```json
[
  {
    "name": "Virat Sharma",
    "age": 26,
    "role": "Batter",
    "foreign": false,
    "bio": "Explosive top-order batter",
    "stats": {
      "matches": 42,
      "runs": 1640,
      "average": 41.2,
      "strike_rate": 137.4
    }
  }
]
```

The import flow MUST NOT immediately insert the records.

Flow:

```text
Paste JSON
    ↓
Parse
    ↓
Validate schema
    ↓
Show preview
    ↓
Show errors/warnings
    ↓
Allow organizer to edit preview
    ↓
Organizer confirms
    ↓
Persist players
```

Invalid JSON must produce a useful error.

Partial invalid records should be clearly identified.

Do not silently discard invalid fields.

Allow organizer to edit imported players after import.

---

# 14. Base Price

There is exactly ONE global base price for an auction.

Example:

```text
Base price = ₹5,00,000
```

Every player begins at this amount.

Do not support individual player base prices in V1.

Re-auctioned players use the same global base price.

---

# 15. Bid Increments

Organizer configures exactly three increments.

Example:

```text
₹5L
₹2L
₹1L
```

The live bidding interface displays:

```text
[ + ₹5L ] [ + ₹2L ] [ + ₹1L ]
```

Do not allow arbitrary manual bid entry.

When a captain clicks an increment, the backend calculates:

```text
new_bid = current_bid + selected_increment
```

Never accept a client-supplied final bid as authoritative.

---

# 16. Purse

Each team has a configured starting purse.

Example:

```text
₹1 Crore
```

When a player is sold:

```text
team.remaining_purse -= sale_price
team.spent_purse += sale_price
```

The same player cannot be purchased by two teams.

The server must atomically validate purse availability before accepting a bid.

A team cannot bid if it cannot afford the resulting bid.

---

# 17. Minimum Players

Organizer configures the squad size at tournament setup.

Example:

```text
Squad size = 11
```

This configuration is locked once the auction starts.

The organizer does not configure mandatory role composition in V1.

No rules such as:

```text
minimum 3 bowlers
minimum 2 wicketkeepers
```

are required.

Only total squad size matters.

---

# 18. Tiers

Tiers are optional.

Organizer can disable tiers entirely.

If enabled, organizer defines the tiers.

Do not hardcode:

```text
A
B
C
```

Instead support arbitrary organizer-defined names.

Example:

```text
Marquee
Consistent Performers
Emerging Players
Young Guns
```

Each tier has:

```text
id
tournament_id
name
description
display_order
```

Organizer can assign players to tiers.

Organizer can determine how many players belong to each tier.

Once the auction starts, tiers become immutable.

---

# 19. Auction Ordering

Do not implement custom drag-and-drop ordering in V1.

The organizer selects the supported auction ordering behavior during configuration.

Support:

* Random
* By tier
* By role
* Sequential/default

The exact ordering must be determined by the backend.

Once the auction starts, the resulting ordering cannot be changed.

If random ordering is selected, generate and persist the order before auction execution so reconnects do not change the sequence.

---

# 20. Auction Lifecycle

Implement an explicit state machine.

Suggested states:

```text
DRAFT
CONFIGURED
SCHEDULED
LIVE
PAUSED
COMPLETED
```

Player states:

```text
PENDING
CURRENT
SOLD
UNSOLD
```

An auction cannot transition backwards into configuration after starting.

---

# 21. Immutable Configuration

CRITICAL REQUIREMENT:

Once the auction is started, configuration cannot be modified.

This includes:

* Team count
* Team names
* Captains
* Squad size
* Purse
* Base price
* Bid increments
* Timer configuration
* Tier configuration
* Player pool
* Auction ordering
* Auction rules

Do not expose edit controls for these values during LIVE/PAUSED/COMPLETED states.

Do not merely hide the buttons.

The backend must reject mutation requests as well.

---

# 22. Duplicate Auction

Because configuration cannot be changed after starting, provide:

```text
Duplicate Auction
```

This creates a new tournament/auction based on the existing configuration.

Copy:

* Tournament metadata
* Teams
* Team names
* Team logos
* Captain assignments
* Players
* Player statistics
* Player tiers
* Auction settings
* Purse
* Squad size
* Bid increments
* Base price
* Timer settings
* Ordering configuration

Do NOT copy:

* Sold status
* Previous bids
* Previous auction events
* Spent purse
* Existing auction-control lock
* Current auction state

The duplicated auction begins as a fresh configurable auction.

---

# 23. Starting the Auction

Only the organizer or authorized auctioneer who currently holds the auction-control lock can start the auction.

Starting the auction performs a final validation:

```text
All required teams exist
All teams have captains
Squad size valid
Purse valid
Base price valid
Three increments configured
Players exist
Ordering valid
Schedule valid
```

After successful start:

```text
configuration_locked = true
```

Persist this permanently for that auction.

---

# 24. Current Player

The auction has exactly one current player when a player is being auctioned.

The current player screen displays:

```text
Player photo
Name
Age
Role
Foreign indicator
Tier
Bio
Statistics
Base price
Current bid
Current highest-bidding team
```

Make the player the visual focal point.

---

# 25. Bidding State

For the current player maintain:

```text
current_bid
highest_bidder_team_id
bid_count
```

When a valid bid occurs:

```text
BID_PLACED
```

is persisted as an event.

Then broadcast the updated state over WebSockets.

All connected:

* organizers
* auctioneers
* captains
* viewers

must see the updated bid.

Only eligible captains see active bid controls.

---

# 26. Bid Validation

Every bid must be validated server-side.

Validate:

```text
Authenticated user
        ↓
User is captain
        ↓
Captain belongs to this tournament
        ↓
Captain controls a team
        ↓
Auction is LIVE
        ↓
Current user has bidding permission
        ↓
Current player exists
        ↓
Player is currently being auctioned
        ↓
Selected increment is one of the configured increments
        ↓
New bid is greater than current bid
        ↓
Team has enough purse
        ↓
Auction control/session state is valid
```

If any condition fails, reject the bid.

Return a useful error.

---

# 27. Atomic Bidding

Bids must be atomic.

Two captains may click simultaneously.

The system must guarantee that the final accepted bid sequence is deterministic and valid.

Use database transactions and appropriate locking.

Do not allow:

```text
Team A reads ₹20L
Team B reads ₹20L
Team A writes ₹25L
Team B writes ₹25L
```

as two independently accepted bids.

The resulting event stream must correctly represent:

```text
₹20L
→ ₹25L Team A
→ ₹30L Team B
```

or whichever transaction wins first.

---

# 28. Sell Player

Only the active auctioneer/organizer can mark a player SOLD.

When sold:

```text
player.status = SOLD
player.sold_to_team_id = winning_team
player.sale_price = current_bid
```

Update team:

```text
spent_purse += current_bid
remaining_purse -= current_bid
squad_count += 1
```

Create:

```text
PLAYER_SOLD
```

event.

Broadcast the result.

The player moves to the team's squad.

---

# 29. Unsold Player

If there are no bids, organizer/active auctioneer can mark the player:

```text
UNSOLD
```

Create:

```text
PLAYER_UNSOLD
```

event.

Do not modify any team purse.

Player moves to unsold pool.

---

# 30. Re-auction

Organizer/active auctioneer can select an unsold player for re-auction.

The player:

```text
UNSOLD
→ CURRENT
```

and begins again at the global base price.

Do not create a duplicate player record.

Maintain the same player ID.

Maintain auction history showing:

```text
first auction attempt
UNSOLD
re-auction
eventual SOLD/UNSOLD
```

---

# 31. Auction Timer

Timer is optional.

Organizer configures:

```text
Timer enabled: true/false
Timer duration: N seconds
```

If enabled, display countdown prominently.

Timer state must be server-authoritative.

Do not rely on a browser's local countdown as the source of truth.

Persist the authoritative end timestamp.

Clients derive remaining time from server state.

Timer expiry must be handled server-side.

Do not allow a captain to manipulate timer state through frontend code.

---

# 32. Pause/Resume

Only active auction controller can pause/resume.

When paused:

* No bids accepted
* Timer stops
* Viewer sees PAUSED
* Captain sees disabled bid controls

When resumed:

* Auction continues
* Timer resumes if configured

Persist events:

```text
AUCTION_PAUSED
AUCTION_RESUMED
```

---

# 33. Event-Driven Architecture

Auction actions must generate immutable domain events.

At minimum:

```text
AUCTION_CREATED
AUCTION_CONFIGURED
AUCTION_STARTED
AUCTION_PAUSED
AUCTION_RESUMED
CONTROL_ACQUIRED
CONTROL_RELEASED
PLAYER_INTRODUCED
BID_PLACED
PLAYER_SOLD
PLAYER_UNSOLD
PLAYER_REAUCTIONED
AUCTION_COMPLETED
```

Events should contain:

```text
id
auction_id
event_type
actor_user_id
payload
sequence_number
created_at
```

Use a monotonically increasing sequence number per auction.

This is important for WebSocket clients to detect missing events.

---

# 34. WebSocket Architecture

Implement an auction-specific WebSocket channel.

Conceptually:

```text
/ws/auctions/{auction_id}
```

When a client connects:

1. Authenticate if required.
2. Determine role.
3. Load current authoritative auction state.
4. Send initial snapshot.
5. Subscribe to future events.

Example:

```json
{
  "type": "AUCTION_STATE",
  "sequence": 184,
  "auction": {},
  "current_player": {},
  "teams": []
}
```

Then events:

```json
{
  "type": "BID_PLACED",
  "sequence": 185,
  "payload": {}
}
```

Clients must process events in sequence.

If a sequence gap occurs:

```text
expected 186
received 188
```

the client must request/resync the current state.

---

# 35. Reconnection

A browser may disconnect.

On reconnect:

```text
WebSocket reconnect
       ↓
Authenticate
       ↓
Join auction
       ↓
Receive current authoritative snapshot
       ↓
Resume realtime events
```

Never rely on the browser's previous state.

The backend is the source of truth.

---

# 36. Public Live Auction

Every auction should have a shareable public URL.

Example:

```text
/auction/{slug}/live
```

The public page requires no captain permissions.

Viewers can see:

* Current player
* Current bid
* Highest bidder/team
* Teams
* Team logos
* Purse remaining
* Squad sizes
* Sold players
* Unsold players
* Upcoming players
* Auction history
* Top purchases
* Player statistics

No bid controls.

No organizer controls.

No captain controls.

---

# 37. Captain Auction Interface

Captain sees the same live auction information plus their bidding controls.

Example:

```text
Current bid: ₹25L

[ + ₹5L ] [ + ₹2L ] [ + ₹1L ]
```

The captain's own team should be visually identifiable.

Display:

```text
YOUR TEAM
Purse remaining
Spent
Players acquired
Players remaining
```

Disable bid buttons when:

* Auction paused
* No current player
* Captain's team cannot afford increment
* Team squad is full
* Auction completed
* User no longer has captain permission

---

# 38. Organizer Auction Interface

Organizer/auctioneer dashboard should provide controls:

```text
Current Player
Next Player
Pause
Resume
Sell
Unsold
Re-auction
Auction History
Control Status
```

Show:

```text
Current controller
Connection status
Auction state
Timer
Current bid
Current bidder
```

Make destructive actions require confirmation where appropriate.

---

# 39. Auction History

Provide a chronological event log.

Example:

```text
15:21:04
Virat Sharma introduced

15:21:11
Warriors bid ₹5L

15:21:15
Titans bid ₹7L

15:21:20
Warriors bid ₹12L

15:21:30
Virat Sharma SOLD to Warriors for ₹12L
```

Show actor where appropriate.

The event history is also the primary audit trail.

---

# 40. Undo

Implement controlled undo for auction actions where safe.

Do NOT physically delete events.

Instead, create compensating events or perform a server-authoritative correction.

For example:

```text
PLAYER_SOLD
       ↓
UNDO_SALE
```

The UI should clearly communicate that a correction occurred.

Never mutate historical events silently.

---

# 41. Dashboard

Tournament dashboard should show:

```text
Tournament name
Status
Scheduled date/time
Number of teams
Squad size
Purse
Player count
Sold count
Unsold count
Remaining players
```

Provide navigation:

```text
Overview
Teams
Players
Tiers
Auction Settings
Live Auction
Auction History
Results
```

Configuration pages must become read-only after auction start.

---

# 42. Player Management UI

Organizer can:

* Create
* Edit
* Delete
* Search
* Filter
* Sort
* Bulk import
* Assign tier
* Mark foreign
* View stats

Filters:

```text
Role
Tier
Foreign
Sold
Unsold
Pending
```

After auction begins, player configuration is locked.

However, normal post-auction result viewing remains available.

---

# 43. Results

After completion provide:

```text
Team
Captain
Players
Player purchase prices
Total spent
Remaining purse
Highest purchase
Squad size
```

Also provide tournament-level statistics:

```text
Total players
Players sold
Players unsold
Highest bid
Highest purchased player
Total money spent
Average purchase price
```

---

# 44. Final PDF

Organizer can generate one PDF containing all teams.

PDF should include:

```text
Tournament title
Tournament metadata

Team 1
    Logo
    Captain
    Squad
    Player stats
    Purchase price
    Total spent
    Remaining purse
    Highest purchase

Team 2
...

Overall auction summary
```

The PDF should be polished and printable.

Use a proper PDF generation library on the backend.

Do not generate the PDF from a screenshot of the frontend.

---

# 45. Database Model

Create a normalized PostgreSQL schema.

At minimum include:

```text
users
tournaments
teams
team_memberships / captain assignments
auctioneers
players
tiers
auctions
auction_players
auction_events
bids
```

You may introduce additional tables if they make the design cleaner.

Use UUIDs or another robust non-sequential public identifier strategy.

Use foreign keys and database constraints.

Create appropriate indexes for:

```text
auction_id
tournament_id
user_id
team_id
player_id
event sequence
auction status
```

---

# 46. API Design

Use REST APIs for normal application operations and WebSockets for live auction events.

Organize routes logically:

```text
/auth
/users
/tournaments
/teams
/players
/tiers
/auctions
/auction-events
/results
```

Examples:

```text
POST   /api/tournaments
GET    /api/tournaments/{id}
PATCH  /api/tournaments/{id}

POST   /api/tournaments/{id}/players
POST   /api/tournaments/{id}/players/import
PATCH  /api/players/{id}

POST   /api/auctions/{id}/start
POST   /api/auctions/{id}/pause
POST   /api/auctions/{id}/resume

POST   /api/auctions/{id}/control/acquire
POST   /api/auctions/{id}/control/release

POST   /api/auctions/{id}/bid
POST   /api/auctions/{id}/sell
POST   /api/auctions/{id}/unsold
POST   /api/auctions/{id}/reauction

POST   /api/auctions/{id}/duplicate
```

Use Pydantic schemas for request/response validation.

---

# 47. Authorization

Never implement authorization purely in React.

Every mutation endpoint must verify:

```text
authenticated user
+
tournament membership
+
role
+
auction state
+
auction control lock where necessary
```

Examples:

A viewer calling `/bid` → 403.

A captain calling `/sell` → 403.

A non-controller auctioneer calling `/sell` → 403.

A captain attempting to bid for another team's ID → 403.

An organizer attempting to modify locked configuration → 409 or appropriate domain error.

---

# 48. Concurrency

Treat concurrency as a first-class concern.

Important race conditions:

### Two captains bid simultaneously

Only valid sequential bids are accepted.

### Two auctioneers acquire control

Only one succeeds.

### Sell and bid happen simultaneously

The backend must serialize them correctly.

A bid arriving after the player has been sold must be rejected.

### Two clients attempt to sell

Only one sell operation can succeed.

Use database transactions and locking.

---

# 49. Error Handling

Use consistent API errors.

Example:

```json
{
  "error": {
    "code": "AUCTION_NOT_ACTIVE",
    "message": "This auction is currently paused."
  }
}
```

Create domain-specific error codes for:

```text
AUCTION_LOCKED
AUCTION_NOT_ACTIVE
NOT_AUCTION_CONTROLLER
NOT_CAPTAIN
INVALID_BID_INCREMENT
INSUFFICIENT_PURSE
SQUAD_FULL
PLAYER_NOT_CURRENT
PLAYER_ALREADY_SOLD
PLAYER_ALREADY_UNSOLD
CONFIGURATION_LOCKED
CONTROL_ALREADY_ACQUIRED
```

---

# 50. UI/UX Direction

The UI should feel like a modern sports-tech product rather than an enterprise admin dashboard.

Visual direction:

* Dark mode first, but support light mode
* Strong typography
* Large player photography
* Colorful team accents
* Minimal cards
* Subtle gradients
* Smooth transitions
* Clear bid animations
* Team logos prominent but not excessive
* Green emphasis for successful sale
* Muted styling for unsold players
* Strong visual hierarchy during bidding

The live auction screen should feel exciting.

The spectator page should be visually useful even without interaction.

Avoid excessive glassmorphism.

Avoid unnecessary gradients and decorative UI.

Prioritize readability during a fast auction.

---

# 51. Responsive Design

The application must work on:

* Desktop
* Laptop
* Tablet
* Mobile

The auction controller is primarily desktop-oriented.

Captain bidding must remain usable on mobile.

Viewer experience should be excellent on mobile because shared links will likely be opened on phones.

---

# 52. Accessibility

Use semantic HTML.

Buttons must have meaningful labels.

Do not communicate important auction state using color alone.

Bid controls need accessible labels.

Keyboard navigation should work for organizer controls.

---

# 53. Security

Implement:

* Password hashing
* Secure authentication
* Authorization middleware
* Input validation
* Rate limiting on bid endpoints
* WebSocket authentication
* CSRF protection where applicable
* Secure CORS configuration
* SQL injection protection through ORM/query parameterization
* XSS-safe rendering
* Audit trail for auction operations

Never trust:

```text
role
team_id
bid amount
auction state
purse
current player
```

sent by the frontend.

The server derives these values.

---

# 54. Rate Limiting

Bid endpoint must be protected from accidental or malicious spam.

Do not allow a client to flood thousands of bid requests per second.

However, do not make rate limiting so aggressive that legitimate rapid bidding is impossible.

Use a reasonable per-user/per-auction limit.

---

# 55. State Recovery

If the backend restarts during an auction:

* PostgreSQL remains authoritative for persisted auction state/events.
* Redis may be rebuilt.
* WebSocket clients reconnect.
* Auction resumes from persisted state.
* No bid history is lost.

Do not store critical auction state only in memory.

---

# 56. Testing

Write comprehensive automated tests.

## Unit tests

Test:

* Purse calculations
* Bid increments
* Squad limits
* Auction state transitions
* Tier ordering
* Random ordering
* Unsold/re-auction
* Timer logic
* Permission checks

## Integration tests

Test:

* Authentication
* Tournament creation
* Player import
* Captain assignment
* Auction start
* Bid
* Sell
* Unsold
* Re-auction
* Duplicate auction
* PDF generation

## Concurrency tests

Explicitly test:

```text
simultaneous bids
simultaneous sell
simultaneous control acquisition
bid vs sell race
reconnection during auction
```

## End-to-end tests

Simulate:

```text
Organizer creates tournament
        ↓
Adds teams
        ↓
Assigns captains
        ↓
Imports players
        ↓
Reviews import
        ↓
Schedules auction
        ↓
Starts auction
        ↓
Captain A bids
        ↓
Captain B bids
        ↓
Organizer sells
        ↓
Next player
        ↓
Unsold
        ↓
Re-auction
        ↓
Auction completed
        ↓
Generate PDF
```

---

# 57. Seed Data

Provide development seed data.

Create:

```text
Demo Organizer
4 demo captains
4 demo teams
20+ demo players
Multiple tiers
Demo statistics
```

The application should be immediately testable after setup.

Do not use real people's personal information.

---

# 58. Developer Experience

Provide:

```text
README.md
.env.example
docker-compose.yml
database migrations
seed script
frontend setup
backend setup
test commands
production build commands
```

The README should explain:

```text
How to run locally
How to create database
How to run migrations
How to seed demo data
How to run tests
How WebSockets work
How auction state works
How to build production
```

---

# 59. Project Structure

Keep frontend and backend cleanly separated.

Suggested:

```text
/
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   └── shared/
│
├── docker/
├── docs/
├── tests/
├── docker-compose.yml
├── .env.example
└── README.md
```

Adjust this structure if a better architecture is justified, but maintain clear boundaries.

---

# 60. Implementation Strategy

Do NOT attempt to implement every feature in one uncontrolled pass.

Build in phases.

## Phase 1 — Foundation

Implement:

* Repository
* Docker
* PostgreSQL
* Redis
* Authentication
* Users
* Basic Next.js UI
* Database migrations

Verify everything works.

## Phase 2 — Tournament Setup

Implement:

* Tournament creation
* Organizer
* Teams
* Captains
* Auctioneers
* Team logos
* Player CRUD
* JSON import/preview
* Tiers
* Configuration

Add tests.

## Phase 3 — Auction Engine

Implement:

* Auction state machine
* Auction ordering
* Current player
* Bidding
* Purse
* Squad limits
* Sell
* Unsold
* Re-auction
* Event log
* Control lock

This is the most important phase.

## Phase 4 — Realtime

Implement:

* WebSocket server
* Auction snapshots
* Event broadcasting
* Sequence numbers
* Reconnection
* State resynchronization
* Live captain UI
* Live spectator UI

Test concurrency.

## Phase 5 — Results

Implement:

* Tournament results
* Team summaries
* Player summaries
* Statistics
* Auction history
* PDF generation

## Phase 6 — Polish

Implement:

* Responsive UI
* Animations
* Empty states
* Error states
* Loading states
* Accessibility
* Mobile UX
* Dark/light themes

## Phase 7 — Hardening

Run:

* Unit tests
* Integration tests
* E2E tests
* Concurrency tests
* Security checks
* Build checks
* Docker production build

---

# 61. Important Product Constraints

These are NON-NEGOTIABLE:

1. Configuration cannot change after auction starts.
2. Duplicate Auction is the mechanism for creating a modified version.
3. Organizer manages players.
4. JSON player import must have a preview/validation/edit step before persistence.
5. Only captains can bid.
6. Organizer/authorized auctioneer controls auction actions.
7. Only one auction controller can have control at a time.
8. Other auctioneers are view-only while control is locked.
9. Bid increments are exactly three configurable increments.
10. No arbitrary manual bid amounts.
11. Base price is global across the auction.
12. Re-auction uses the same base price.
13. Squad configuration is total squad size only.
14. Foreign players display a flight indicator.
15. Tiers are optional and organizer-defined.
16. No custom player drag-and-drop ordering in V1.
17. Auction state is server authoritative.
18. Auction events are persisted.
19. Realtime updates use WebSockets.
20. Critical mutations are protected by server-side authorization.
21. Critical auction operations are transaction-safe.
22. Public viewers never receive bidding controls.
23. PDF contains all final team results.
24. Never trust frontend-provided purse, role, team, bid, or auction-state information.

---

# 62. Definition of Done

The application is considered complete only when a developer can perform this entire flow successfully:

```text
Register
   ↓
Create tournament
   ↓
Become organizer
   ↓
Configure 4 teams
   ↓
Assign registered users as captains
   ↓
Add auctioneer
   ↓
Configure purse
   ↓
Configure squad size
   ↓
Configure base price
   ↓
Configure 3 increments
   ↓
Enable/configure tiers
   ↓
Import players through JSON
   ↓
Preview + edit import
   ↓
Confirm players
   ↓
Schedule auction
   ↓
Share public auction URL
   ↓
Start auction
   ↓
Configuration becomes locked
   ↓
Auction controller acquires lock
   ↓
Player appears
   ↓
Captains bid in realtime
   ↓
Viewers see bids instantly
   ↓
Player SOLD
   ↓
Team purse updates
   ↓
Next player
   ↓
Player UNSOLD
   ↓
Player RE-AUCTIONED
   ↓
Player SOLD
   ↓
Auction completed
   ↓
View final squads
   ↓
Generate final PDF
```

The system must behave correctly if:

* a captain refreshes
* a viewer disconnects
* the auctioneer refreshes
* two captains bid simultaneously
* two auctioneers try to acquire control
* someone attempts unauthorized API calls
* a bid arrives immediately after SELL
* the backend restarts
* a WebSocket connection drops
* a player is re-auctioned
* an organizer attempts to modify locked configuration

---

# 63. Codex Working Rules

While implementing:

* First inspect the repository and existing code.
* Do not overwrite existing working functionality unnecessarily.
* Before adding dependencies, check whether an existing dependency already solves the requirement.
* Keep domain logic out of React components.
* Keep auction business logic in a dedicated backend/domain layer.
* Use typed request/response models.
* Use database migrations for schema changes.
* Never silently swallow errors.
* Add tests alongside important domain functionality.
* Keep commits/changes logically separated where possible.
* Do not build mock auction logic that bypasses the real backend.
* Do not use frontend timers as authoritative auction state.
* Do not use localStorage as the source of truth for auction state.
* Do not trust client-supplied roles or team IDs.
* Do not implement authorization only in the UI.
* Do not fake WebSocket behavior with polling.
* Do not leave critical features as TODO placeholders.

When a design decision is ambiguous, prioritize:

```text
Server authority
> Data integrity
> Race-condition safety
> Security
> Simplicity
> UX polish
```

Before declaring completion, run the test suite, linting/type checks, database migrations, and production builds.

Document any unavoidable tradeoffs in `docs/architecture.md`.

The final result should be a coherent, production-oriented cricket auction platform rather than a prototype composed of disconnected screens.

