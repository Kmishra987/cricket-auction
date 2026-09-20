# Cricket Auction Platform — Product, Design & Delivery Plan

> Status: Active implementation — foundation, identity, setup, auction engine, realtime, results, and PDF baseline are implemented; operator polish and release hardening remain.
> 
> This document is the design contract and phased implementation plan for the production-quality cricket auction platform described in `specs.md`.

## 1. Product north star

Build the most legible, exciting, and trustworthy way to run a live cricket auction. The product should feel like a polished sports broadcast control room: energetic during bidding, calm during setup, and exact about money, permissions, and history.

The experience takes inspiration from Duolingo's clarity, color, encouragement, and approachable playfulness—not its branding or visual patterns. The visual language is anchored in a confident Framer-blue system, strong editorial typography, team color accents, and restrained motion.

### Product principles

1. **The auction is the product.** Setup exists to make the live event reliable; it should not feel like generic CRUD.
2. **Every important state is obvious.** LIVE, PAUSED, SOLD, UNSOLD, YOUR TURN, and READ-ONLY must be perceivable without relying on color alone.
3. **Server truth beats client optimism.** The UI can feel immediate, but it must never invent a bid, purse, timer, permission, or auction state.
4. **Fast to scan, hard to misunderstand.** Auction screens favor hierarchy, large numbers, and stable spatial layout over decoration.
5. **Joy is reserved for meaningful moments.** Celebrate a sale, successful setup, and first-run guidance; keep high-frequency bidding feedback crisp.
6. **Designed for the room and the phone.** The controller needs dense desktop tooling; captains and spectators need excellent mobile experiences.

## 2. Brand direction

### Working product character

Confident, lively, precise, communal, broadcast-ready, and welcoming.

Avoid: generic enterprise admin, casino-like flashing, excessive glassmorphism, noisy gradients, giant dashboards full of equal-weight cards, or visual effects that compete with the current player and bid.

### Color system

Framer Blue is the action color. It carries focus, active navigation, links, controls, and the live auction pulse. Team colors are accents and must never replace the system meaning colors.

#### Core tokens

```css
--blue-500: #0099FF;       /* primary action / Framer Blue */
--blue-400: #2AA8FF;
--blue-600: #0077CC;
--blue-700: #005A9C;

--ink-950: #07111F;        /* dark canvas */
--ink-900: #0B1626;
--ink-800: #122238;
--ink-700: #243752;
--ink-500: #6D7E96;
--ink-300: #B9C5D4;
--ink-100: #EAF0F7;
--white: #FFFFFF;

--surface-dark: #0F1C2E;
--surface-dark-raised: #14253B;
--surface-light: #FFFFFF;
--surface-light-muted: #F4F7FB;

--success-500: #22C982;    /* sold / positive balance */
--success-700: #128A58;
--warning-500: #F6B73C;    /* attention / timer */
--danger-500: #F0525F;     /* destructive / error */
--purple-500: #8B6DFF;     /* tier / editorial accent */
--cyan-500: #28D7D0;       /* secondary data accent */
```

#### Semantic tokens

Use semantic tokens in components; never hard-code palette values in feature screens.

```css
--color-bg: var(--ink-950);
--color-surface: var(--surface-dark);
--color-surface-raised: var(--surface-dark-raised);
--color-text: var(--white);
--color-text-muted: var(--ink-300);
--color-border: color-mix(in srgb, var(--ink-300) 16%, transparent);
--color-action: var(--blue-500);
--color-action-hover: var(--blue-400);
--color-focus: var(--blue-400);
--color-success: var(--success-500);
--color-warning: var(--warning-500);
--color-danger: var(--danger-500);
```

Light mode inverts surfaces and text while preserving semantic meaning. Dark mode is the primary mode for live auction use; the UI must remain readable under projector-like low-light conditions.

### Typography

- Primary typeface: **Inter Variable** or an equivalent variable sans with excellent tabular numerals.
- Display/hero moments: use the same family at heavier weight rather than adding a novelty display font.
- Use `font-variant-numeric: tabular-nums` for bids, purses, countdowns, squad counts, and statistics.
- Weight scale: 400 regular, 500 medium, 600 semibold, 700 bold, 800 display.
- Body: 15–16px with 1.45–1.55 line height.
- Labels/metadata: 12–13px, medium/semibold, slightly increased tracking.
- Live bid: 48–72px on desktop, 36–48px on mobile; never allow the bid number to jump position when it changes.
- Minimum interactive text size: 14px.

### Layout and spacing

Base spacing unit: 4px. Use a small, deliberate scale:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`

- App shell max width: 1440px.
- Content reading max width: 1120px.
- Live auction desktop grid: `minmax(0, 1.55fr) minmax(320px, 0.75fr)`.
- Mobile breakpoint: 767px; tablet: 1024px; wide layout: 1280px.
- Default page gutter: 24px desktop, 16px mobile.
- Sections should have one clear focal axis. Avoid nested cards inside nested cards unless there is a strong information boundary.

### Shape, borders, and depth

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 18px;
--radius-xl: 24px;
--radius-pill: 999px;
--shadow-card: 0 12px 32px rgb(0 0 0 / 0.18);
--shadow-float: 0 20px 56px rgb(0 0 0 / 0.24);
--ring-focus: 0 0 0 3px rgb(0 153 255 / 0.35);
```

Use borders for grouping and elevation for priority. No component should use both a heavy border and a heavy shadow by default.

## 3. Design system components

### App shell

- Desktop: compact left rail with tournament switcher, primary navigation, connection/status indicator, and profile menu.
- Mobile: top bar with tournament identity plus bottom navigation for the most-used areas.
- Live auction mode can enter a focused shell that reduces non-auction navigation and gives the current player more room.
- Persistent status must include connection state and auction state where relevant.

### Buttons

Variants: `primary`, `secondary`, `ghost`, `danger`, `success`, `icon`, `increment`.

- Primary action: Framer blue fill, white label.
- Increment button: large, high-contrast, explicit `+ ₹5L` label, with keyboard and screen-reader label.
- Sale action: success styling but still requires confirmation if it ends a player auction.
- Destructive action: danger styling and confirmation dialog.
- Every pressable element has hover, focus-visible, disabled, and active states.
- Active press feedback: `transform: scale(0.97)` over 120ms; never animate layout.

### Status and role badges

Use icon + text, not color alone:

- `LIVE` — blue pulse dot + text.
- `PAUSED` — pause icon + amber text.
- `SOLD` — check icon + green text.
- `UNSOLD` — minus icon + muted text.
- `READ ONLY` — lock icon + muted text.
- `YOUR TEAM` — team mark + blue outline.
- `FOREIGN` — flight icon + text in player detail contexts.

### Cards and panels

Cards are for clear boundaries: player identity, team summary, auction control, event history, import preview. They should have one title, one dominant value, and an optional supporting action.

The current-player panel is a stage, not a normal card: use a larger radius, generous breathing room, player photo treatment, and a stable bid area.

### Forms

- Labels always visible; placeholders are examples only.
- Group configuration into steps: identity, teams, purse/rules, tiers, player pool, schedule, review.
- Inline validation for obvious fields; submit-level validation for cross-field rules.
- Locked configuration uses read-only presentation with a clear `Locked after auction start` explanation, not disabled fields that look broken.

### Tables and lists

- Use tables for player management and results on desktop.
- Convert to stacked list rows with a primary value and disclosure on mobile.
- Preserve scan order: player, status, team, price, action.
- Use skeletons only for content blocks that will actually load; never make the live bid area look like it is still loading after a snapshot arrives.

### Auction-specific primitives

1. **Bid display** — current price, bid count, highest team, and a server-synced update timestamp.
2. **Team purse card** — remaining purse is primary; spent, squad count, and room for players are secondary.
3. **Control lock banner** — active controller, acquire/release action when authorized, and read-only explanation for other auctioneers.
4. **Auction timer** — server-derived countdown with warning thresholds; never imply client ownership.
5. **Event timeline** — sequence-aware, chronological, actor-aware, and resilient to reconnect/resync.
6. **Import preview** — row-level validation, warnings, editable fields, confirm-to-persist action.
7. **Sale celebration** — short, tasteful confirmation focused on player, team, and price.

## 4. Motion and interaction guidelines

Motion has a purpose: feedback, state indication, spatial consistency, preventing a jarring content change, or rare delight. It is not a substitute for hierarchy.

### Motion tokens

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
--duration-press: 120ms;
--duration-fast: 160ms;
--duration-ui: 200ms;
--duration-panel: 240ms;
--stagger: 48ms;
```

### Approved motion map

| Interaction | Purpose | Motion | Timing |
| --- | --- | --- | --- |
| Button press | Feedback | `transform: scale(0.97)` | 120ms ease-out |
| Hover/focus | Feedback | color, border, shadow only | 160ms ease |
| Drawer/modal | Spatial consistency | opacity + translate/scale from 0.96 | 200–240ms ease-out |
| Player introduction | Prevent jarring change | crossfade + subtle upward motion | 240ms ease-out |
| Accepted bid | State indication | number crossfade; team marker update | 160ms ease-out |
| Sale confirmation | Delight + state indication | short success pulse/celebration | 240ms ease-out, once |
| List entry | Prevent jarring change | opacity + 8px translate, 48ms stagger | 200ms ease-out |
| Reconnect/resync | State indication | static status transition; no dramatic replay | 160ms ease-out |

Rules:

- Animate `transform` and `opacity` whenever possible; do not animate width, height, margin, padding, or layout position for routine UI.
- No animation on keyboard-driven high-frequency navigation.
- No bouncing bid numbers or flashing timer. The auction must feel exciting without obscuring data.
- Use CSS transitions for simple state changes and Motion only where interruptible layout/gesture behavior genuinely requires it.
- Gate hover motion with `@media (hover: hover) and (pointer: fine)`.
- Ship a `prefers-reduced-motion: reduce` variant that keeps opacity/color feedback but removes translation, scale, and celebratory movement.
- Keep routine UI motion under 300ms.

## 5. Accessibility and inclusive behavior

- WCAG AA contrast target for all text and controls.
- Semantic landmarks: header, nav, main, aside, footer; heading order reflects hierarchy.
- All live auction updates announced through a polite live region; urgent errors are assertive but concise.
- Do not announce every bid as an interruption on the public page; provide an accessible event log and a concise current-state announcement.
- Keyboard focus order follows the visual auction flow: current player → bid controls → team context → history.
- Focus-visible ring uses the blue focus token and never gets removed.
- Touch targets are at least 44×44px.
- Color-blind-safe status treatment uses icon, label, and shape/position.
- Images require useful alt text; decorative team marks are marked decorative when adjacent text already names the team.
- Mobile bid controls remain reachable without forcing a user to scroll away from the current bid.

## 6. Domain and implementation constraints

These constraints come from `specs.md` and are non-negotiable.

### Authority and integrity

- Neon PostgreSQL is authoritative for persisted auction state and events.
- Bun owns the API and native WebSocket process for now; connected clients are broadcast to from that process.
- Use PostgreSQL transactions and advisory/row locks for bid, sell, and controller-lock correctness.
- Redis is intentionally deferred. Add it only when multiple realtime instances or durable background jobs are actually needed; it must never become the source of truth.
- Every mutation derives role, team, purse, current player, auction state, and permissions on the server.
- All bid, sell, control-lock, and state-transition operations run inside safe database transactions with appropriate row/advisory locking.
- Persist immutable events with monotonically increasing per-auction sequence numbers.
- Undo uses compensating events; historical events are never silently edited or deleted.

### Product rules

- Configuration becomes immutable after auction start. Duplicate Auction creates the editable fresh copy.
- Exactly three configured bid increments; no arbitrary manual bid entry.
- One global base price; re-auction uses the same base price.
- Squad limit is total squad size only in V1; no role-composition rules.
- Tiers are optional and organizer-defined.
- No drag-and-drop auction ordering in V1; ordering is backend-determined and persisted.
- Only captains bid; only the active controller sells, pauses, resumes, advances, or re-auctions.
- Only one auction controller can hold the server-side control lock at a time; disconnect does not auto-transfer it.
- Viewers never receive bid controls.
- JSON import always follows parse → validate → preview/edit → confirm → persist.
- Timer is server-authoritative via persisted end timestamp; clients derive remaining time.
- Public share links expose spectator data only.

### Engineering quality bars

- Clear frontend/backend boundary; domain logic stays out of React components.
- Typed API schemas, migrations, seed data, consistent domain errors, and rate limiting on bid endpoints.
- WebSocket authentication, snapshot on join/reconnect, sequence-gap detection, and resync.
- Tests cover unit rules, integration flow, concurrency races, authorization, reconnection, and PDF generation.
- No mock auction logic that bypasses the real backend; no localStorage or browser timers as authority.

## 7. Information architecture and primary screens

### Authenticated organizer shell

- Dashboard / tournament list
- Tournament overview
- Setup wizard and configuration review
- Teams and captain assignments
- Players: table, create/edit, import preview
- Tiers
- Auction settings
- Live auction controller
- Auction history
- Results and PDF generation
- Duplicate auction

### Captain experience

- Tournament list
- Live auction with own-team context and bid controls
- Players / teams / squad details
- Auction history

### Viewer experience

- Public `/auction/{slug}/live`
- Current player and bid
- Teams and purse summaries
- Sold/unsold/upcoming players
- History, top purchases, and player statistics

## 8. Phased delivery plan

Each phase ends with a working, reviewable checkpoint. Do not move on with known correctness gaps in the auction domain.

### Phase 0 — Product and design foundation

Deliverables:

- This `plan.md` approved as the design and delivery contract.
- Repository scaffold decision documented.
- Tokenized theme, typography, spacing, layout primitives, and base components.
- Storybook or an equivalent component showcase for core states.
- Route map and role/state matrix.

Exit checks:

- Dark/light themes render consistently.
- Button, form, table, badge, panel, player card, purse card, timer, and status primitives cover the core UI.
- Reduced-motion and keyboard behavior is demonstrated.

### Phase 1 — Foundation and identity

Deliverables:

- Simple workspace with `apps/web`, `apps/server`, `packages/shared`, `tests`, and `docs`; no Docker layer.
- Bun server using TypeScript, native `Bun.serve` request handling, and Bun's WebSocket API for live connections.
- Neon PostgreSQL with Drizzle ORM and Drizzle Kit migrations. Drizzle is the deliberately smaller fit for Bun + Neon and keeps SQL-visible transaction boundaries.
- Next.js TypeScript app with Tailwind and the design tokens.
- User model, secure password hashing, registration/login/session flow, authorization middleware, migrations, and seed data.
- README, `.env.example`, health checks, and local setup commands.

Exit checks:

- A developer can boot the stack from a clean checkout.
- Users can register, log in, log out, and see only authorized tournaments.
- Unit/integration tests and type/lint checks pass.

### Phase 2 — Tournament setup and player pool

Deliverables:

- Tournament creation and organizer ownership.
- Teams, deterministic SVG logo generator, captain assignment, auctioneer assignment.
- Tournament settings: purse, squad size, base price, exactly three increments, timer, tiers, ordering, schedule/timezone.
- Player CRUD with flexible stats, foreign-player indicator, tier assignment, search/filter/sort.
- JSON import parse/validation/preview/edit/confirm flow with row-level errors and warnings.
- Configuration review screen with explicit “locks on start” messaging.

Exit checks:

- Organizer can create a complete valid auction without using admin-only shortcuts.
- Invalid configuration is rejected with useful domain errors.
- All setup mutations are protected server-side.

### Phase 3 — Auction domain engine

Deliverables:

- Explicit auction and player state machines.
- Persisted auction ordering, current player lifecycle, global base price, bid validation, purse math, squad limits.
- Sell, unsold, re-auction, pause/resume, completion.
- Server-side controller lock with acquire/release and atomic race-safe behavior.
- Immutable event log with sequence numbers and compensating undo events.
- Domain error catalog and transaction boundaries.

Exit checks:

- Unit tests cover every state transition and every non-negotiable product rule.
- Concurrency tests cover simultaneous bids, sell/bid races, simultaneous control acquisition, and double sell.
- Direct unauthorized API calls fail even when the client sends forged role/team/state data.

### Phase 4 — Realtime auction experience

Deliverables:

- Authenticated auction WebSocket channel using Bun's native WebSocket server.
- Initial authoritative snapshot, ordered event stream, sequence-gap resync, reconnect handling.
- Organizer controller UI with lock state, current player, timer, controls, history, connection health.
- Captain UI with own-team emphasis, purse-aware increment buttons, disabled states, bid feedback.
- Public spectator page with no bidding controls and excellent mobile layout.

Exit checks:

- All connected roles converge on the same state after every event.
- Reconnect receives a fresh snapshot and resumes correctly.
- Timer is derived from server state and pauses/resumes correctly.
- Viewers cannot access captain or controller capabilities.

### Phase 5 — Results, audit, and PDF

Deliverables:

- Results dashboard with team summaries, squads, prices, purse, highest purchase, and tournament statistics.
- Chronological event history with actor and correction visibility.
- Backend-generated polished PDF containing all team results and overall summary.
- Duplicate auction flow that copies configuration but resets live state, events, bids, and purse usage.

Exit checks:

- Completed auctions produce internally consistent team and tournament totals.
- PDF is generated from backend data, is printable, and matches the results screen.
- Duplicate auction begins as a fresh editable auction.

### Phase 6 — Polish and responsive quality

Deliverables:

- Motion map from this document implemented with reduced-motion fallbacks.
- Loading, empty, error, offline/reconnecting, locked, paused, sold, and unsold states.
- Mobile captain bid flow tested on narrow screens.
- Light/dark theme refinement, visual hierarchy pass, copy pass, accessibility pass.
- Visual regression snapshots for high-value screens.

Exit checks:

- No layout shift in current-player/bid areas.
- No animation obscures auction data or makes a fast bid feel delayed.
- Keyboard, screen reader, contrast, reduced motion, and touch target checks pass.

### Phase 7 — Hardening and release

Deliverables:

- Full unit, integration, E2E, concurrency, security, build, and migration checks.
- Production Bun build and documented deployment configuration.
- Rate-limit and abuse checks for bid endpoints and WebSockets.
- Backend restart/recovery test during an active auction.
- `docs/architecture.md` with unavoidable tradeoffs.
- Final README with Bun install/run, migrate, seed, test, WebSocket, and production commands.

Exit checks:

- The complete Definition of Done flow in `specs.md` passes from registration through PDF.
- Known limitations are documented; no critical TODO placeholders remain.

## 9. Definition-of-done walkthrough

The final acceptance run will execute this exact scenario:

```text
Register organizer + captains
→ create tournament
→ configure teams, captains, auctioneer, purse, squad size, base price, increments, tiers
→ import players through preview/edit/confirm
→ schedule and share public URL
→ acquire controller lock and start auction
→ verify configuration is locked
→ run realtime bids from two captain sessions
→ sell a player and verify purse/squad/event updates
→ mark a player unsold and re-auction the same player
→ pause/resume and verify server timer behavior
→ complete auction
→ inspect history and results
→ generate PDF
→ duplicate auction and verify fresh state
→ refresh/reconnect clients and repeat authorization/concurrency checks
```

## 10. Working cadence and review gates

At the end of each phase, the implementation will be shown against:

1. **Behavior:** does the domain rule work through the real backend?
2. **Authority:** can a forged or stale client bypass it?
3. **Realtime:** do connected clients converge after normal and race-condition paths?
4. **Design:** does the surface use the tokens and visual hierarchy in this document?
5. **Accessibility:** can keyboard, touch, reduced-motion, and assistive technology users complete the task?
6. **Verification:** do tests, type checks, linting, migrations, and builds pass?

## 11. Decision log

- **Visual direction:** sports-tech control room with approachable game-like energy, not a generic admin template.
- **Primary theme:** dark-first for live auction readability; light theme supported for setup and general use.
- **Accent:** Framer Blue anchors product actions; team colors are contextual accents.
- **Animation approach:** CSS-first for simple feedback, Motion only for interruptible or layout-aware behavior; all motion is reduced-motion safe.
- **Public identity:** deterministic SVG team logos in V1; AI image generation is not a product dependency.
- **Runtime:** Bun + TypeScript for the API and live server; no Python service and no Docker requirement.
- **Database:** Neon PostgreSQL + Drizzle ORM/Kit for visible SQL and compact migrations.
- **Realtime:** native Bun WebSocket with one Bun process for V1; PostgreSQL transactions/locks protect correctness.
- **Scaling deferral:** Redis is not part of the initial architecture; introduce it only for multi-instance WebSocket fan-out or durable jobs.
- **Implementation order:** domain correctness before realtime polish, realtime before results polish, polish before hardening.

## 12. Current implementation status

- Phase 0: design contract, tokenized visual foundation, reduced-motion behavior, and a dark/light theme toggle implemented.
- Phase 1: Bun workspace, Neon-over-443 database access, Drizzle schema/migrations, auth/session flow, seed data, health checks, and environment documentation implemented.
- Phase 2: tournament settings, teams, captains, players, tiers, import validation, configuration locking, and the organizer rules/access setup panel implemented.
- Phase 3: auction state machine, transactional bidding, controller lock, event sequencing, sell/unsold/re-auction, pause/resume, completion, and undo baseline implemented.
- Phase 4: native Bun WebSocket rooms, optional session identity on connections, authoritative snapshots, sequence-gap resync, reconnect handling, server-derived timer, live spectator surface, persisted event trail, and controller re-auction action implemented.
- Phase 5: results aggregation, duplicate auction baseline, and PDF generation implemented.
- Remaining: expand the full organizer-to-PDF E2E flow, add the remaining bid/sell race cases, finish visual QA/accessibility pass, and production hardening.

Verified checkpoints:

- `bun run typecheck`
- `bun --cwd apps/server test --reporter dot`
- `bun --cwd apps/web build`
- `bun --env-file=.env run test:integration`

The real Neon integration suite currently verifies the seeded public snapshot, a transaction over seeded child records, seeded organizer authentication/protected configuration reads, public/protected results, backend PDF generation, duplicate-auction freshness with cleanup, and simultaneous controller acquisition serialization. The full engine lifecycle has also been exercised during development; its disposable cleanup harness was intentionally kept out of the repeatable gate because Neon teardown latency made that test flaky.
