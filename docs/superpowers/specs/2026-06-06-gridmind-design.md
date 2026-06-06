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
  (dashboard)/              # Route group: shared dark layout + nav
    page.tsx                # / — Dashboard
    optimize/page.tsx       # /optimize — AI Optimization Engine
    scheduler/page.tsx      # /scheduler — Workload Scheduler
    reports/page.tsx        # /reports — Energy Reports
    alerts/page.tsx         # /alerts — Alert Management
    settings/page.tsx       # /settings — Configuration
    layout.tsx              # Shared nav + dark background
  api/
    telemetry/
      generate/route.ts     # POST — produce one 30s tick, insert to DB, return snapshot
      history/route.ts      # GET  — last N rows for charts (24h/7d/30d)
    cooling/route.ts        # GET  — latest cooling_state rows
    prices/route.ts         # GET  — latest energy_prices rows
    ai/
      optimize/route.ts     # POST — snapshot → Claude → store + return recommendations
      report/route.ts       # POST — period metrics → Claude → executive summary
    alerts/route.ts         # GET  — list alerts with filters
    alerts/[id]/route.ts    # PATCH — resolve alert
    recommendations/route.ts       # GET  — list recommendations
    recommendations/[id]/route.ts  # PATCH — update status
    seed/route.ts           # POST — one-time 7-day historical seed
lib/
  supabase.ts               # Browser Supabase client
  supabase-server.ts        # Server Supabase client (service key)
  types.ts                  # TypeScript types for all DB rows
  telemetry-sim.ts          # Simulation math (shared by generate + seed routes)
  claude.ts                 # Anthropic client, system prompt, typed helpers
components/
  ui/                       # shadcn/ui primitives
  dashboard/
    MetricCard.tsx          # Animated gradient stat card
    RackHeatmap.tsx         # 4x5 grid color-coded by temp
    PowerChart.tsx          # Recharts line chart with time toggle
    InsightFeed.tsx         # Live recommendation panel
  optimize/
    RecommendationCard.tsx  # Priority card with savings + confidence
  scheduler/
    Timeline.tsx            # 24h workload + price + renewable chart
  shared/
    Nav.tsx                 # Logo, links, status indicator
    StatusIndicator.tsx     # Pulsing green dot
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
  cpu_pct       numeric(5,2) NOT NULL,
  ram_pct       numeric(5,2) NOT NULL,
  temp_c        numeric(5,2) NOT NULL,
  power_w       numeric(8,2) NOT NULL,
  workload_type text NOT NULL,          -- 'inference' | 'training' | 'idle'
  timestamp     timestamptz NOT NULL DEFAULT now()
)

-- One row per tick per CRAC unit (4 units)
cooling_state (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       text NOT NULL,          -- 'crac-1' .. 'crac-4'
  setpoint_c    numeric(5,2) NOT NULL,
  fan_speed_pct numeric(5,2) NOT NULL,
  power_w       numeric(8,2) NOT NULL,
  timestamp     timestamptz NOT NULL DEFAULT now()
)

-- One row per tick (spot price + renewable mix)
energy_prices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_per_kwh numeric(6,4) NOT NULL,
  renewable_pct numeric(5,2) NOT NULL,
  timestamp     timestamptz NOT NULL DEFAULT now()
)

-- AI-generated optimization recommendations
ai_recommendations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                  text NOT NULL,  -- 'cooling_adjustment' | 'workload_shift' | 'server_consolidation' | 'alert'
  priority              text NOT NULL,  -- 'critical' | 'high' | 'medium' | 'low'
  description           text NOT NULL,
  action                text NOT NULL,
  estimated_kwh_savings numeric(10,2) NOT NULL DEFAULT 0,
  estimated_usd_savings numeric(10,2) NOT NULL DEFAULT 0,
  confidence            numeric(4,3)  NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'pending',  -- 'pending' | 'applied' | 'dismissed'
  created_at            timestamptz NOT NULL DEFAULT now()
)

-- System alerts (AI-detected anomalies + threshold breaches)
alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   text,                     -- nullable, null = system-wide
  severity    text NOT NULL,            -- 'critical' | 'high' | 'medium' | 'low'
  type        text NOT NULL,            -- 'temperature' | 'power' | 'performance' | 'cooling'
  message     text NOT NULL,
  resolved    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
)
```

### Indexes

```sql
CREATE INDEX idx_server_telemetry_timestamp ON server_telemetry (timestamp DESC);
CREATE INDEX idx_server_telemetry_server_time ON server_telemetry (server_id, timestamp DESC);
CREATE INDEX idx_energy_prices_timestamp ON energy_prices (timestamp DESC);
CREATE INDEX idx_alerts_status_time ON alerts (resolved, created_at DESC);
```

### Access Pattern

- **API routes** use `SUPABASE_SERVICE_KEY` (bypasses RLS) for all reads and writes.
- **Browser client** uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (read-only RLS policy on all tables).

---

## Telemetry Simulation (`lib/telemetry-sim.ts`)

All simulation math lives here and is shared by the `/api/telemetry/generate` and `/api/seed` routes.

### Server simulation

20 servers across 4 racks (srv-01–05 in rack-A, srv-06–10 in rack-B, etc.). Per server per tick:

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

1. Call `generateTick(now())` from `telemetry-sim.ts`
2. Bulk-insert 20 server rows + 4 cooling rows + 1 price row into Supabase
3. Check thresholds — if any server `temp_c > 80` or `power_w > 420`, insert an alert row
4. Return the full snapshot as JSON

### `GET /api/telemetry/history?range=24h|7d|30d`

Query `server_telemetry` aggregated by time bucket (1min for 24h, 1h for 7d, 6h for 30d). Return total power draw and average PUE per bucket.

### `POST /api/ai/optimize`

1. Fetch latest snapshot (last tick of all 20 servers + cooling + prices)
2. Send to Claude with the optimization system prompt
3. Parse JSON response into `Recommendation[]`
4. Bulk-insert into `ai_recommendations`
5. Return array to client

### `POST /api/ai/report`

1. Accept `{ startDate, endDate }` body
2. Aggregate metrics from `server_telemetry` + `energy_prices` for range
3. Send metrics object to Claude asking for executive summary
4. Return 3-paragraph string

### `POST /api/seed`

Insert 7 days × 24h × 120 ticks/h × 20 servers of historical data using `telemetry-sim.ts` deterministic functions. Only runs if `server_telemetry` is empty.

---

## AI Integration (`lib/claude.ts`)

### Client

```typescript
import Anthropic from '@anthropic-ai/sdk'
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

### Model

`claude-sonnet-4-6` (streaming enabled for optimize route)

### System prompt (optimization engine)

```
You are GridMind's AI optimization engine, an expert in data center energy efficiency.
You will receive a JSON snapshot of real-time server telemetry, cooling state, electricity
prices, and renewable energy availability. Analyze the data and return a JSON array of
optimization recommendations. Each recommendation must follow this exact schema:
{ type, priority, description, action, estimated_kwh_savings, estimated_usd_savings, confidence }.
Be specific and quantitative. Focus on the highest-impact opportunities first.
```

### Recommendation schema

```typescript
type RecommendationType = 'cooling_adjustment' | 'workload_shift' | 'server_consolidation' | 'alert'
type Priority = 'critical' | 'high' | 'medium' | 'low'

interface Recommendation {
  type: RecommendationType
  priority: Priority
  description: string
  action: string
  estimated_kwh_savings: number
  estimated_usd_savings: number
  confidence: number  // 0–1
}
```

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

- **Row 1:** 5 `MetricCard`s — Total Power Draw (kW), PUE, Cooling Load (kW), Monthly Cost ($), CO₂ (kg). Each card has a subtle animated gradient border in its accent color.
- **Row 2:** `RackHeatmap` (left 2/3) + `InsightFeed` (right 1/3)
- **Row 3:** `PowerChart` full-width with 24h/7d/30d tab toggle
- Entire page auto-refreshes data every 30s via `setInterval`

### Optimize (`/optimize`)

- Header with "Run Analysis" button and last-run timestamp
- Loading state: skeleton cards + "GridMind is analyzing..." text with animated dots
- Results: `RecommendationCard` grid, sorted critical → low
- Each card shows: colored priority badge, type label, description paragraph, action callout box, kWh savings, $ savings, confidence progress bar

### Scheduler (`/scheduler`)

- Recharts `ComposedChart`: bar series (workload per server), line series (price curve), area series (renewable %)
- X-axis: 0–23h. Green shaded regions = AI optimal windows.
- "Apply AI Schedule" button opens a modal with before/after cost comparison table, then updates workload assignments on confirm

### Reports (`/reports`)

- Date range picker (default: last 30 days)
- Metric summary cards with trend arrows vs. prior period
- "Generate AI Summary" button with loading state
- Rendered summary in a styled `prose` blockquote

### Alerts (`/alerts`)

- Filter bar: severity (all/critical/high/medium/low), type, status (open/resolved)
- Sortable table: severity badge, type, server, message, timestamp, Resolve button
- Resolved rows grayed out

### Settings (`/settings`)

- Form fields: electricity cost ($/kWh), CO₂ factor (kg/kWh), temp alert threshold (°C), power alert threshold (W), AI analysis frequency (manual/hourly/daily)
- Saved to `localStorage` under key `gridmind_settings`
- Used by telemetry threshold checks and cost calculations

---

## Key Derived Metrics

**PUE** = (Total IT Power + Cooling Power) / Total IT Power

**Monthly Cost** = (Total Power kW × 24 × 30) × price_per_kwh from settings

**CO₂ (kg)** = Total kWh × co2_factor from settings × (1 − renewable_pct/100)

---

## Seeding

On first visit to the dashboard, if the DB is empty, `POST /api/seed` is called automatically. This inserts 7 days of historical data using deterministic simulation so charts have data from day one.

---

## Error Handling

- AI routes: catch Anthropic errors, return `{ error: message }` with appropriate HTTP status
- Telemetry generate: idempotent — safe to call multiple times per 30s window
- All API routes: typed request/response with Zod validation on inputs
