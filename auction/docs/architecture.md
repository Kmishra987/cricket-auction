# Auction Room architecture

## Runtime

- **Bun + TypeScript** owns the HTTP API and the live WebSocket server.
- **Next.js + React** owns the browser experience.
- **Neon PostgreSQL** is the source of truth for users, configuration, auction state, bids, and immutable events.
- **Drizzle ORM** keeps transaction boundaries and SQL-visible behavior close to the domain code.

## Realtime

The server uses Bun's native WebSocket API. Each auction is a room keyed by auction ID. A client receives an authoritative snapshot on connect and after every committed mutation. Messages carry the persisted event sequence; a client that detects a gap requests `RESYNC` and receives a fresh snapshot.

The browser timer is only a rendering of persisted `timerEndsAt`. Timer expiry is checked by the server and converted into a persisted `PLAYER_UNSOLD` event.

## Database connectivity

The server has two Neon clients. Authentication/session operations use `neon()` through `drizzle-orm/neon-http`, which sends SQL over HTTPS/443. Auction mutations use `Pool` through `drizzle-orm/neon-serverless` so PostgreSQL transactions, row locks, and event sequencing remain atomic. Both clients use the same `DATABASE_URL`; the HTTP path is the fallback for networks that block WebSockets.

## Deliberate V1 omissions

- **No Docker:** local development uses Bun directly and keeps the setup small.
- **No Redis:** one Bun process handles WebSocket fan-out. PostgreSQL transactions protect correctness. Add Redis only when multiple realtime instances or durable background jobs are required.
- **No custom WebSocket abstraction:** the room registry is a small in-process map around Bun's native socket interface.
- **No frontend source of truth:** optimistic bid state, local timers, and localStorage are not used to decide auction outcomes.

## Correctness boundaries

Critical mutations lock the auction row inside a PostgreSQL transaction. Bid validation, purse checks, squad limits, controller ownership, configuration locking, event sequencing, and settlement all happen server-side. A process-local 250ms bid throttle protects against accidental spam; it should become shared only when the API is deployed across multiple instances.

## Recovery

Restarting the Bun process loses only connected sockets, not auction state. Clients reconnect to the public or authenticated room, receive a fresh snapshot from PostgreSQL, and continue from persisted state. The database event log remains the audit trail for results and corrections.
