# GridMind — Design Specification

**Date:** 2026-06-06
**Status:** Approved

---

## Overview

GridMind is an AI-powered data center energy optimization platform built as a Next.js 14 web application. It simulates real-time telemetry from a 20-server, 4-rack data center, surfaces AI-driven optimization recommendations via the Anthropic Claude API, and presents everything through a dark-themed operations dashboard.

---

## Architecture

### Approach

Pure Next.js 14 (App Router) monolith. All telemetry generation, AI calls, and data queries are handled through Next.js API routes. The frontend polls API routes on 30-second intervals — matching the telemetry cadence — with no separate scheduler process or external queue.

### Tech Stack

- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Charts:** Recharts
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude API (`claude-sonnet-4-6`)
- **Auth:** Supabase Auth — stubbed (no login UI; routes unprotected in v1)

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
ANTHROPIC_API_KEY
```

### Directory Structure

```
app/
  (dashboard)/                      # Route group: shared dark layout + nav
    page.tsx                        # / — Dashboard
    optimize/page.tsx               # /optimize — AI Optimization Engine
    scheduler/page.tsx              # /scheduler — Workload Scheduler
    reports/page.tsx                # /reports — Energy Reports
    alerts/page.tsx                 # /alerts — Alert Management
    settings/page.tsx               # /settings — Configuration
    layout.tsx                      # Shared nav + dark background
  api/
    telemetry/
      generate/route.ts             # POST — produce one 30s tick, insert to DB, return snapshot
      history/route.ts              # GET  — time-bucketed power+PUE for charts (24h/7d/30d)
    cooling/route.ts                # GET  — latest cooling_state rows (one per unit)
    prices/route.ts                 # GET  — latest energy_prices row
    ai/
      optimize/route.ts             # POST — snapshot → Claude → store + return recommendations
      report/route.ts               # POST — period metrics → Claude → executive summary
    alerts/route.ts                 # GET  — list alerts with filters
    alerts/[id]/route.ts            # PATCH — resolve alert (sets resolved=true, resolved_at=now)
    recommendations/route.ts        # GET  — list recommendations
    recommendations/[id]/route.ts   # PATCH — update status (applied/dismissed)
    scheduler/route.ts              # GET  — 24h workload + price data for timeline
    scheduler/apply/route.ts        # POST — apply AI schedule (update server workload_type)
    reports/metrics/route.ts        # GET  — aggregate metrics for arbitrary date range
    seed/route.ts                   # POST — chunked 7-day historical seed
lib/
  supabase.ts                       # Browser Supabase client
  supabase-server.ts                # Server Supabase client (service key)
  types.ts                          # TypeScript types for all DB rows
  telemetry-sim.ts                  # Simulation math (shared by generate + seed routes)
  claude.ts                         # Anthropic client + system prompt + typed helpers
  validations.ts                    # Zod schemas for API inputs and Claude outputs
components/
  ui/                               # shadcn/ui primitives
  dashboard/
    MetricCard.tsx                  # Animated gradient stat card
    RackHeatmap.tsx                 # 4x5 grid color-coded by temp
    PowerChart.tsx                  # Recharts line chart with time toggle
    InsightFeed.tsx                 # Live recommendation panel
  optimize/
    RecommendationCard.tsx          # Priority card with savings + confidence
  scheduler/
    Timeline.tsx                    # 24h workload + price + renewable chart
  shared/
    Nav.tsx                         # Logo, links, status indicator
    StatusIndicator.tsx             # Pulsing green dot
```

---

## Database Schema

### Tables

```sql
-- 20 servers x 4 racks, one row per tick per server
server_telemetry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id     text NOT NULL,          -- 'srv-01' .. 'srv-20'
  rack_id       text NOT NULL,          -- 'rack-A' .. 'rack-D'
  cpu_pct       numeric(5,2)  NOT NULL,
  ram_pct       numeric(5,2)  NOT NULL,
  temp_c        numeric(5,2)  NOT NULL,
  power_w       numeric(8,2)  NOT NULL,
  workload_type text          NOT NULL
                CHECK (workload_type IN ('inference','training','idle')),
  is_scheduled  boolean       NOT NULL DEFAULT false,  -- true = inserted by scheduler, not live telemetry
  timestamp     timestamptz   NOT NULL DEFAULT now()
)

-- One row per tick per CRAC unit (4 units)
cooling_state (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       text          NOT NULL,  -- 'crac-1' .. 'crac-4'
  setpoint_c    numeric(5,2)  NOT NULL,
  fan_speed_pct numeric(5,2)  NOT NULL,
  power_w       numeric(8,2)  NOT NULL,
  timestamp     timestamptz   NOT NULL DEFAULT now()
)

-- One row per tick (spot price + renewable mix)
energy_prices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_per_kwh numeric(6,4)  NOT NULL,
  renewable_pct numeric(5,2)  NOT NULL,
  timestamp     timestamptz   NOT NULL DEFAULT now()
)

-- AI-generated optimization recommendations
ai_recommendations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                  text         NOT NULL
                        CHECK (type IN ('cooling_adjustment','workload_shift','server_consolidation','alert')),
  priority              text         NOT NULL
                        CHECK (priority IN ('critical','high','medium','low')),
  description           text         NOT NULL,
  action                text         NOT NULL,
  estimated_kwh_savings numeric(10,2) NOT NULL DEFAULT 0,
  estimated_usd_savings numeric(10,2) NOT NULL DEFAULT 0,
  confidence            numeric(4,3)  NOT NULL DEFAULT 0
                        CHECK (confidence BETWEEN 0 AND 1),
  status                text         NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','applied','dismissed')),
  created_at            timestamptz  NOT NULL DEFAULT now()
)

-- System alerts (AI-detected anomalies + threshold breaches)
alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   text,                       -- nullable: null = system-wide alert
  severity    text        NOT NULL
              CHECK (severity IN ('critical','high','medium','low')),
  type        text        NOT NULL
              CHECK (type IN ('temperature','power','performance','cooling')),
  message     text        NOT NULL,
  resolved    boolean     NOT NULL DEFAULT false,
  resolved_at timestamptz,                -- set when resolved=true
  created_at  timestamptz NOT NULL DEFAULT now()
)
```

### Indexes

```sql
-- server_telemetry: primary access patterns
CREATE INDEX idx_server_telemetry_timestamp      ON server_telemetry (timestamp DESC);
CREATE INDEX idx_server_telemetry_server_time    ON server_telemetry (server_id, timestamp DESC);
-- partial index for live-only snapshot queries (used by AI optimize route)
CREATE INDEX idx_server_telemetry_live_snapshot  ON server_telemetry (server_id, timestamp DESC)
  WHERE is_scheduled = false;

-- cooling_state: time-range queries
CREATE INDEX idx_cooling_state_timestamp         ON cooling_state (timestamp DESC);

-- energy_prices: latest + time-range queries
CREATE INDEX idx_energy_prices_timestamp         ON energy_prices (timestamp DESC);

-- alerts: filter by status + recency
CREATE INDEX idx_alerts_status_time              ON alerts (resolved, created_at DESC);

-- ai_recommendations: filter by status + priority
CREATE INDEX idx_recommendations_status_time     ON ai_recommendations (status, created_at DESC);
CREATE INDEX idx_recommendations_priority_time   ON ai_recommendations (priority, created_at DESC);
```

### Access Pattern

- **API routes** use `SUPABASE_SERVICE_KEY` (bypasses RLS) for all reads and writes.
- **Browser client** uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (read-only RLS policy on all tables).

---

## Telemetry Simulation (`lib/telemetry-sim.ts`)

All simulation math lives here and is shared by the `/api/telemetry/generate` and `/api/seed` routes.

### Server simulation

20 servers across 4 racks (srv-01–05 in rack-A, srv-06–10 in rack-B, srv-11–15 in rack-C, srv-16–20 in rack-D). Per server per tick:

- **CPU %:** base load keyed to server index + workload type + sinusoidal drift + ±5% noise
- **RAM %:** correlated with CPU, slower drift
- **Temp °C:** 18–85°C range; derived from CPU% and ambient temp with thermal lag factor
- **Power W:** 80–450W range; derived from CPU% with idle floor
- **Workload type:** most servers `inference`; 2–3 servers `training` during business hours; night hours shift some to `idle`

### Cooling simulation

4 CRAC units. Setpoint tracks ambient + 5°C. Fan speed correlates with average rack temp. Power scales with fan speed.

### Energy price curve

- Off-peak (23:00–06:00): $0.04–0.06/kWh
- Shoulder (06:00–09:00, 18:00–23:00): $0.08–0.12/kWh
- Peak (09:00–18:00): $0.14–0.22/kWh
- ±random jitter ±5%

### Renewable percentage

- Solar: Gaussian bell curve peaking at noon (~40%), zero at night
- Wind: constant low-level base (5–15%) + random noise
- Combined: capped at 95%

### Ambient temperature

Sinusoidal: base 20°C ± 8°C over 24h, cooler at night.

---

## API Routes

### `POST /api/telemetry/generate`

1. Call `generateTick(now())` from `telemetry-sim.ts` — produces one batch of 20 server rows, 4 cooling rows, 1 price row
2. Bulk-insert all rows via Supabase service client
3. **Threshold check:** if any server row has `temp_c > 80` OR `power_w > 420`, insert an alert row with appropriate severity and message. Thresholds are hardcoded constants in this route for v1 (default: 80°C / 420W).
4. Return the full tick as JSON (all 20 server rows + 4 cooling rows + 1 price row)

### `GET /api/telemetry/history?range=24h|7d|30d`

Queries both `server_telemetry` and `cooling_state` in a time window. Returns time-bucketed data:

- **24h:** 1-minute buckets → sum of `power_w` across all servers per bucket, sum of cooling `power_w` per bucket
- **7d:** 1-hour buckets
- **30d:** 6-hour buckets

**PUE per bucket** = (sum server power + sum cooling power) / sum server power. Both tables are queried with the same timestamp range filter. Bucket alignment uses `date_trunc`.

Return shape: `{ timestamp: string, total_kw: number, cooling_kw: number, pue: number }[]`

### `GET /api/cooling`

Returns the latest row per `unit_id` (4 rows). Uses `SELECT DISTINCT ON (unit_id) ... ORDER BY unit_id, timestamp DESC`.

### `GET /api/prices`

Returns the single most recent `energy_prices` row.

### `POST /api/ai/optimize`

1. Fetch "latest snapshot": for each of the 20 server IDs, select the row with the maximum `timestamp` WHERE `is_scheduled = false`. This ensures all servers are represented by their most recent live reading, excluding any scheduler-applied future rows. Also fetch latest cooling (4 rows) and latest price (1 row).
2. Construct the snapshot JSON and send to Claude (non-streaming, synchronous response) with the optimization system prompt
3. Parse the response text as JSON and validate against the `RecommendationSchema` Zod array schema (see `lib/validations.ts`)
4. On Zod validation failure: log the raw response, return `{ error: 'Invalid AI response', raw: string }` with HTTP 422. Do not insert partial data.
5. On valid parse: bulk-insert into `ai_recommendations`, return the inserted rows
6. On Anthropic SDK error: return `{ error: message }` with appropriate HTTP status (401, 429, 500)

### `POST /api/ai/report`

1. Accept `{ startDate: string, endDate: string, co2Factor?: number }` body (validated with Zod; `co2Factor` defaults to 0.4 if omitted)
2. Fetch aggregate metrics from `server_telemetry` + `energy_prices` for the range (same logic as `/api/reports/metrics`)
3. Send metrics object to Claude with a report-generation system prompt requesting 3 concise paragraphs suitable for ESG reporting
4. Return `{ summary: string }` — the raw text, no JSON parsing needed

### `GET /api/reports/metrics?startDate=&endDate=&co2Factor=`

Accepts arbitrary ISO date strings and optional `co2Factor` float (Zod-validated; default 0.4 kg/kWh if omitted). Aggregates:
- Total kWh consumed (server + cooling power × time intervals)
- Average PUE
- Peak load (max single-bucket power draw)
- Total cost (kWh × avg price_per_kwh from energy_prices in range)
- Total CO₂ (kWh × `co2Factor` × (1 − avg renewable_pct))
- Renewable % (avg renewable_pct from energy_prices in range)

The frontend passes `settings.co2Factor` from localStorage as the `co2Factor` query param so the Reports page reflects the same factor the user configured in Settings.

Also computes the same metrics for the immediately prior period of equal length, for trend comparison.

Return shape: `{ current: MetricSummary, prior: MetricSummary }`

### `GET /api/scheduler`

Returns data needed for the 24h timeline view:
- Hourly workload distribution: count of servers per workload_type per hour for the next 24h (simulated forward from current state)
- 24h energy price forecast: `telemetry-sim.ts` price curve values for hours 0–23 at current date
- 24h renewable forecast: `telemetry-sim.ts` renewable curve values for hours 0–23
- AI-suggested optimal windows: hours where `price_per_kwh < $0.08` AND `renewable_pct > 30%` are flagged as optimal for training workloads

### `POST /api/scheduler/apply`

1. Accept `{ assignments: { serverId: string, hour: number, workloadType: string }[] }` body (Zod-validated)
2. For each assignment, insert a future `server_telemetry` row with the specified `workload_type` and a `timestamp` set to that hour today
3. Inserted rows must have `is_scheduled = true` so they are excluded from the live telemetry snapshot used by the AI optimize route.
4. Server IDs in the request are validated against the known set `['srv-01'..'srv-20']` via a Zod enum or `.refine()`. Invalid IDs return HTTP 400.
5. Return before/after cost comparison: `{ beforeCost: number, afterCost: number, savingsUsd: number }`

### `GET /api/alerts?severity=&type=&resolved=`

Query `alerts` table with optional filters. All params optional; unfiltered returns all rows ordered by `created_at DESC`. Returns `Alert[]`.

### `PATCH /api/alerts/[id]`

Sets `resolved = true` and `resolved_at = now()` for the given alert ID. Returns updated row.

### `GET /api/recommendations?status=&priority=`

Query `ai_recommendations` with optional filters, ordered by priority rank then `created_at DESC`. Priority rank: critical=0, high=1, medium=2, low=3.

### `PATCH /api/recommendations/[id]`

Accepts `{ status: 'applied' | 'dismissed' }` (Zod-validated). Updates and returns the row.

### `POST /api/seed`

Inserts 7 days of historical data in chunks to avoid timeouts:

1. Check if `server_telemetry` already has rows — if yes, return `{ skipped: true }`
2. Generate ticks for 7 days at 30s intervals = 20,160 ticks total using `telemetry-sim.ts`
3. Insert in chunks of 200 ticks per batch (200 × 20 = 4,000 server rows per Supabase call)
4. Supabase bulk insert handles each chunk; route streams progress as NDJSON: `{ progress: number, total: number }` per chunk
5. Client reads the stream and shows a progress bar; on completion returns `{ seeded: number }` total rows

---

## AI Integration (`lib/claude.ts`)

### Client

```typescript
import Anthropic from '@anthropic-ai/sdk'
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

### Model

`claude-sonnet-4-6` — synchronous (non-streaming) for both optimize and report routes. Max tokens: 4096.

### Optimization system prompt

```
You are GridMind's AI optimization engine, an expert in data center energy efficiency.
You will receive a JSON snapshot of real-time server telemetry, cooling state, electricity
prices, and renewable energy availability. Analyze the data and return a JSON array of
optimization recommendations. Each recommendation must follow this exact schema:
{ type, priority, description, action, estimated_kwh_savings, estimated_usd_savings, confidence }.
Be specific and quantitative. Focus on the highest-impact opportunities first.
Valid values: type = cooling_adjustment | workload_shift | server_consolidation | alert;
priority = critical | high | medium | low; confidence = 0.0 to 1.0.
Return ONLY the JSON array, no other text.
```

### Claude output validation (`lib/validations.ts`)

```typescript
import { z } from 'zod'

export const RecommendationSchema = z.object({
  type: z.enum(['cooling_adjustment', 'workload_shift', 'server_consolidation', 'alert']),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  description: z.string().min(1),
  action: z.string().min(1),
  estimated_kwh_savings: z.number().min(0),
  estimated_usd_savings: z.number().min(0),
  confidence: z.number().min(0).max(1),
})

export const RecommendationsArraySchema = z.array(RecommendationSchema)
```

On parse: `JSON.parse(responseText)` then `RecommendationsArraySchema.safeParse(parsed)`. If `success === false`, return HTTP 422 with `{ error: 'Invalid AI response', details: zodError.format() }`.

---

## Frontend Pages

### Design System

- **Background:** `#0f172a` (slate-950), cards on `#1e293b` (slate-800)
- **Primary:** `#3b82f6` (blue-500)
- **Good/savings:** `#10b981` (emerald-500)
- **Warning:** `#f59e0b` (amber-500)
- **Critical:** `#ef4444` (red-500)
- **Font:** Geist (Next.js default)
- **Charts:** Recharts with custom dark-theme tooltip + grid

### Nav

Sticky `bg-slate-900/80 backdrop-blur`. Left: lightning bolt SVG + "GridMind" wordmark. Center: Dashboard, Optimize, Scheduler, Reports, Alerts, Settings. Right: `StatusIndicator` (pulsing green dot + "System Status: Nominal").

### Dashboard (`/`)

- On mount, if `server_telemetry` is empty, call `POST /api/seed` and show a seeding progress bar before loading the dashboard
- **Row 1:** 5 `MetricCard`s — Total Power Draw (kW), PUE, Cooling Load (kW), Monthly Cost ($), CO₂ (kg). Each card has a subtle animated gradient border in its accent color. Derived client-side from the snapshot returned by `POST /api/telemetry/generate`.
- **Row 2:** `RackHeatmap` (left 2/3) + `InsightFeed` (right 1/3)
- **Row 3:** `PowerChart` full-width with 24h/7d/30d tab toggle
- Entire page auto-refreshes by calling `POST /api/telemetry/generate` every 30s via `setInterval`

### Optimize (`/optimize`)

- Header with "Run Analysis" button and last-run timestamp
- Loading state: skeleton cards + "GridMind is analyzing..." text with animated dots
- Results: `RecommendationCard` grid, sorted critical → low
- Each card shows: colored priority badge, type label, description paragraph, action callout box, kWh savings, $ savings, confidence progress bar

### Scheduler (`/scheduler`)

- On mount: `GET /api/scheduler` for 24h data
- Recharts `ComposedChart`: bar series (workload per server count), line series (price curve), area series (renewable %)
- X-axis: 0–23h. Green shaded regions = hours flagged as optimal windows
- "Apply AI Schedule" button calls `POST /api/scheduler/apply` with suggested assignments, opens modal with before/after cost comparison table, confirms with user before persisting

### Reports (`/reports`)

- Date range picker (default: last 30 days) — on change, calls `GET /api/reports/metrics?startDate=&endDate=`
- Metric summary cards with trend arrows (% delta vs. prior period from `current` vs `prior` in response)
- "Generate AI Summary" button calls `POST /api/ai/report` with `{ startDate, endDate, co2Factor: settings.co2Factor }`, shows loading state, renders 3-paragraph text in a styled `prose` blockquote

### Alerts (`/alerts`)

- Filter bar: severity (all/critical/high/medium/low), type, status (open/resolved)
- Sortable table: severity badge, type, server (links to `/` dashboard with server highlighted if server_id is set), message, created_at timestamp, resolved_at timestamp (when resolved), Resolve button
- Resolved rows grayed out; Resolve button hidden on already-resolved alerts

### Settings (`/settings`)

- Form fields: electricity cost ($/kWh), CO₂ factor (kg/kWh), display-only note about alert thresholds (v1 thresholds are hardcoded at 80°C / 420W on the server), AI analysis frequency (manual/hourly/daily — informational for v1)
- Saved to `localStorage` under key `gridmind_settings`
- Electricity cost and CO₂ factor are read client-side and used in the dashboard's Monthly Cost and CO₂ derived metric calculations

---

## Key Derived Metrics (client-side)

All computed client-side using the latest tick data:

**Total Power Draw (kW)** = sum of all 20 servers' `power_w` / 1000

**PUE** = (Total Server Power kW + sum of 4 CRAC `power_w` / 1000) / Total Server Power kW

**Cooling Load (kW)** = sum of 4 CRAC `power_w` / 1000

**Monthly Cost ($)** = Total Power Draw kW × 24 × 30 × `settings.electricityCostPerKwh`

**CO₂ (kg)** = (Total Power kW × 24 × 30) × `settings.co2Factor` × (1 − latest `renewable_pct` / 100)

---

## Error Handling

- **AI routes (optimize, report):** Catch `Anthropic.APIError` (covers auth/rate-limit/server errors). Return `{ error: string }` with the HTTP status from the Anthropic error. Catch `JSON.parse` failure and Zod validation failure separately — return HTTP 422 with details.
- **Telemetry generate:** Idempotent. Calling multiple times within a 30s window inserts extra rows — acceptable for v1.
- **Seed route:** Chunked insertion with NDJSON progress stream. If a chunk fails, the route returns an error response mid-stream; client shows an error toast and the user can retry.
- **All API routes:** Zod validation on all inputs. Invalid input returns HTTP 400 with `{ error: string, details: ZodError }`.
- **Missing env vars:** Fail fast at module load time with a descriptive error message.
