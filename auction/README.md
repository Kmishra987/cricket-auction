# Cricket Auction

Production-oriented live cricket auction platform.

## Stack

- Bun + TypeScript server
- Bun's native WebSocket server for live auction connections
- Neon PostgreSQL + Drizzle ORM/Kit
- Next.js + Tailwind-style CSS tokens for the web app

There is intentionally no Docker or Redis dependency in the first version. PostgreSQL is the source of truth; the single Bun process owns WebSocket fan-out until real multi-instance scale requires a separate adapter.

## Local setup

1. Install Bun.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and `SESSION_SECRET`.
3. Install dependencies with `bun install`.
4. Run the server and web app with `bun run dev`.

Useful commands:

```bash
bun run dev:server
bun run dev:web
bun run db:generate
bun run db:migrate
bun run db:seed
bun run typecheck
bun run test:integration
```

The seed creates a repeat-safe demo tournament with two captains and three players. It uses `demo-password-123` for local development only.

`test:integration` uses the configured Neon database and expects the demo seed to exist; the normal server test command does not require a database.

## Runtime shape

The server owns authorization, auction state, bid validation, transactions, and the WebSocket snapshot/event protocol. The browser is a view and input surface only.

See [docs/architecture.md](docs/architecture.md) for the runtime, Neon-over-443, realtime, recovery, and scaling decisions.

The organizer can use `GET /api/users?search=...` to find registered captain accounts. Auction control actions include `/undo` for the latest current-player bid; the correction is persisted in the immutable event history.
