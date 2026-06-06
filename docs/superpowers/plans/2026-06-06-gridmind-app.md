# GridMind Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build GridMind — a full-stack AI-powered data center energy optimization dashboard with simulated telemetry, Claude-powered recommendations, and 6 operational pages.

**Architecture:** Pure Next.js 14 App Router monolith. API routes handle all data ops and AI calls. Frontend polls every 30s. Supabase (PostgreSQL) for persistence. No auth UI in v1.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Recharts, Supabase, Anthropic SDK (`claude-sonnet-4-6`), Zod, Jest

**Spec:** `docs/superpowers/specs/2026-06-06-gridmind-design.md`

---

## File Map

```
# Config
package.json
next.config.mjs
tailwind.config.ts
tsconfig.json
postcss.config.mjs
jest.config.ts
.env.local.example

# Database
supabase/migrations/001_schema.sql

# Library
lib/types.ts
lib/supabase.ts
lib/supabase-server.ts
lib/telemetry-sim.ts
lib/validations.ts
lib/claude.ts

# Tests
__tests__/telemetry-sim.test.ts
__tests__/validations.test.ts

# API Routes
app/api/telemetry/generate/route.ts
app/api/telemetry/history/route.ts
app/api/cooling/route.ts
app/api/prices/route.ts
app/api/seed/route.ts
app/api/ai/optimize/route.ts
app/api/ai/report/route.ts
app/api/alerts/route.ts
app/api/alerts/[id]/route.ts
app/api/recommendations/route.ts
app/api/recommendations/[id]/route.ts
app/api/scheduler/route.ts
app/api/scheduler/apply/route.ts
app/api/reports/metrics/route.ts

# App Shell
app/globals.css
app/layout.tsx
app/(dashboard)/layout.tsx

# Shared Components
components/shared/Nav.tsx
components/shared/StatusIndicator.tsx

# Dashboard Components
components/dashboard/MetricCard.tsx
components/dashboard/RackHeatmap.tsx
components/dashboard/PowerChart.tsx
components/dashboard/InsightFeed.tsx

# Feature Components
components/optimize/RecommendationCard.tsx
components/scheduler/Timeline.tsx

# Pages
app/(dashboard)/page.tsx
app/(dashboard)/optimize/page.tsx
app/(dashboard)/scheduler/page.tsx
app/(dashboard)/reports/page.tsx
app/(dashboard)/alerts/page.tsx
app/(dashboard)/settings/page.tsx
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `next.config.mjs`
- Create: `tailwind.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `jest.config.ts`
- Create: `.env.local.example`
- Create: `app/globals.css`
- Create: `app/layout.tsx`

- [ ] **Step 1: Initialize Next.js project with required dependencies**

```bash
cd /Users/theoneandonly/Suhaib
npx create-next-app@14 . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --yes
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install @supabase/supabase-js @anthropic-ai/sdk recharts zod geist
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D jest jest-environment-node ts-jest @types/jest
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init --defaults
```

When prompted: style=default, base color=slate, CSS variables=yes.

- [ ] **Step 5: Add required shadcn components**

```bash
npx shadcn@latest add button card badge tabs input label dialog progress table skeleton select separator
```

- [ ] **Step 6: Configure Jest**

Create `jest.config.ts`:
```typescript
import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react' } }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/**/*.test.ts'],
}

export default config
```

Add to `package.json` scripts: `"test": "jest"`.

- [ ] **Step 7: Create `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

Copy to `.env.local` and fill in real values.

- [ ] **Step 8: Verify scaffold**

```bash
npm run dev
```

Expected: Next.js dev server starts on http://localhost:3000

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 + shadcn/ui + Supabase + Recharts + Jest"
```

---

## Task 2: Database Schema

**Files:**
- Create: `supabase/migrations/001_schema.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/001_schema.sql`:

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- server_telemetry
CREATE TABLE server_telemetry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id     text NOT NULL,
  rack_id       text NOT NULL,
  cpu_pct       numeric(5,2)  NOT NULL,
  ram_pct       numeric(5,2)  NOT NULL,
  temp_c        numeric(5,2)  NOT NULL,
  power_w       numeric(8,2)  NOT NULL,
  workload_type text          NOT NULL
                CHECK (workload_type IN ('inference','training','idle')),
  is_scheduled  boolean       NOT NULL DEFAULT false,
  timestamp     timestamptz   NOT NULL DEFAULT now()
);

-- cooling_state
CREATE TABLE cooling_state (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       text         NOT NULL,
  setpoint_c    numeric(5,2) NOT NULL,
  fan_speed_pct numeric(5,2) NOT NULL,
  power_w       numeric(8,2) NOT NULL,
  timestamp     timestamptz  NOT NULL DEFAULT now()
);

-- energy_prices
CREATE TABLE energy_prices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_per_kwh numeric(6,4) NOT NULL,
  renewable_pct numeric(5,2) NOT NULL,
  timestamp     timestamptz  NOT NULL DEFAULT now()
);

-- ai_recommendations
CREATE TABLE ai_recommendations (
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
);

-- alerts
CREATE TABLE alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   text,
  severity    text        NOT NULL
              CHECK (severity IN ('critical','high','medium','low')),
  type        text        NOT NULL
              CHECK (type IN ('temperature','power','performance','cooling')),
  message     text        NOT NULL,
  resolved    boolean     NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_server_telemetry_timestamp     ON server_telemetry (timestamp DESC);
CREATE INDEX idx_server_telemetry_server_time   ON server_telemetry (server_id, timestamp DESC);
CREATE INDEX idx_server_telemetry_live_snapshot ON server_telemetry (server_id, timestamp DESC)
  WHERE is_scheduled = false;
CREATE INDEX idx_cooling_state_timestamp        ON cooling_state (timestamp DESC);
CREATE INDEX idx_energy_prices_timestamp        ON energy_prices (timestamp DESC);
CREATE INDEX idx_alerts_status_time             ON alerts (resolved, created_at DESC);
CREATE INDEX idx_recommendations_status_time    ON ai_recommendations (status, created_at DESC);
CREATE INDEX idx_recommendations_priority_time  ON ai_recommendations (priority, created_at DESC);

-- RLS: enable but allow service key to bypass
ALTER TABLE server_telemetry    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooling_state       ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_prices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts              ENABLE ROW LEVEL SECURITY;

-- Anon read-only policies
CREATE POLICY "anon_read" ON server_telemetry    FOR SELECT USING (true);
CREATE POLICY "anon_read" ON cooling_state       FOR SELECT USING (true);
CREATE POLICY "anon_read" ON energy_prices       FOR SELECT USING (true);
CREATE POLICY "anon_read" ON ai_recommendations  FOR SELECT USING (true);
CREATE POLICY "anon_read" ON alerts              FOR SELECT USING (true);
```

- [ ] **Step 2: Run migration in Supabase**

In the Supabase dashboard → SQL Editor, paste and run the migration file content.

Alternatively with Supabase CLI:
```bash
supabase db push
```

- [ ] **Step 3: Verify tables exist**

In Supabase dashboard → Table Editor, confirm all 5 tables are visible.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema with RLS and indexes"
```

---

## Task 3: Supabase Clients and TypeScript Types

**Files:**
- Create: `lib/types.ts`
- Create: `lib/supabase.ts`
- Create: `lib/supabase-server.ts`

- [ ] **Step 1: Create TypeScript types**

Create `lib/types.ts`:

```typescript
export type WorkloadType = 'inference' | 'training' | 'idle'
export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type RecommendationType = 'cooling_adjustment' | 'workload_shift' | 'server_consolidation' | 'alert'
export type RecommendationStatus = 'pending' | 'applied' | 'dismissed'
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'
export type AlertType = 'temperature' | 'power' | 'performance' | 'cooling'

export interface ServerTelemetry {
  id: string
  server_id: string
  rack_id: string
  cpu_pct: number
  ram_pct: number
  temp_c: number
  power_w: number
  workload_type: WorkloadType
  is_scheduled: boolean
  timestamp: string
}

export interface CoolingState {
  id: string
  unit_id: string
  setpoint_c: number
  fan_speed_pct: number
  power_w: number
  timestamp: string
}

export interface EnergyPrice {
  id: string
  price_per_kwh: number
  renewable_pct: number
  timestamp: string
}

export interface AiRecommendation {
  id: string
  type: RecommendationType
  priority: Priority
  description: string
  action: string
  estimated_kwh_savings: number
  estimated_usd_savings: number
  confidence: number
  status: RecommendationStatus
  created_at: string
}

export interface Alert {
  id: string
  server_id: string | null
  severity: AlertSeverity
  type: AlertType
  message: string
  resolved: boolean
  resolved_at: string | null
  created_at: string
}

// API response shapes
export interface TelemetrySnapshot {
  servers: ServerTelemetry[]
  cooling: CoolingState[]
  price: EnergyPrice
}

export interface HistoryBucket {
  timestamp: string
  total_kw: number
  cooling_kw: number
  pue: number
}

export interface MetricSummary {
  total_kwh: number
  avg_pue: number
  peak_kw: number
  total_cost_usd: number
  total_co2_kg: number
  renewable_pct: number
}

export interface MetricsResponse {
  current: MetricSummary
  prior: MetricSummary
}

export interface GridMindSettings {
  electricityCostPerKwh: number
  co2Factor: number
}

export const DEFAULT_SETTINGS: GridMindSettings = {
  electricityCostPerKwh: 0.12,
  co2Factor: 0.4,
}
```

- [ ] **Step 2: Create browser Supabase client**

Create `lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!url || !key) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, key)
```

- [ ] **Step 3: Create server Supabase client**

Create `lib/supabase-server.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_KEY!

if (!url || !key) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY')
}

export const supabaseServer = createClient(url, key, {
  auth: { persistSession: false },
})
```

- [ ] **Step 4: Commit**

```bash
git add lib/
git commit -m "feat: add Supabase clients and TypeScript types"
```

---

## Task 4: Telemetry Simulation Library (TDD)

**Files:**
- Create: `lib/telemetry-sim.ts`
- Create: `__tests__/telemetry-sim.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/telemetry-sim.test.ts`:

```typescript
import { generateTick, getPriceAt, getRenewableAt, SERVERS, CRAC_UNITS } from '@/lib/telemetry-sim'

describe('getPriceAt', () => {
  it('returns off-peak price at 3am', () => {
    expect(getPriceAt(3)).toBeLessThan(0.07)
  })
  it('returns peak price at 12pm', () => {
    expect(getPriceAt(12)).toBeGreaterThan(0.12)
  })
  it('returns shoulder price at 7am', () => {
    const p = getPriceAt(7)
    expect(p).toBeGreaterThan(0.07)
    expect(p).toBeLessThan(0.14)
  })
})

describe('getRenewableAt', () => {
  const now = new Date('2026-06-06T12:00:00Z')
  it('has higher renewable at noon than midnight', () => {
    const noon = getRenewableAt(12, now)
    const midnight = getRenewableAt(0, now)
    expect(noon).toBeGreaterThan(midnight)
  })
  it('returns value between 0 and 95', () => {
    for (let h = 0; h < 24; h++) {
      const r = getRenewableAt(h, now)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(95)
    }
  })
})

describe('generateTick', () => {
  const now = new Date('2026-06-06T14:00:00Z')
  const tick = generateTick(now)

  it('produces 20 server rows', () => {
    expect(tick.servers).toHaveLength(20)
  })
  it('produces 4 cooling rows', () => {
    expect(tick.cooling).toHaveLength(4)
  })
  it('produces 1 price row', () => {
    expect(tick.price).toBeDefined()
    expect(tick.price.price_per_kwh).toBeGreaterThan(0)
  })
  it('all servers have valid ranges', () => {
    for (const s of tick.servers) {
      expect(s.cpu_pct).toBeGreaterThanOrEqual(0)
      expect(s.cpu_pct).toBeLessThanOrEqual(100)
      expect(s.temp_c).toBeGreaterThan(15)
      expect(s.temp_c).toBeLessThan(90)
      expect(s.power_w).toBeGreaterThan(0)
      expect(['inference','training','idle']).toContain(s.workload_type)
      expect(s.is_scheduled).toBe(false)
    }
  })
  it('server IDs are srv-01 through srv-20', () => {
    const ids = tick.servers.map(s => s.server_id)
    expect(ids).toContain('srv-01')
    expect(ids).toContain('srv-20')
  })
  it('rack IDs are rack-A through rack-D', () => {
    const racks = new Set(tick.servers.map(s => s.rack_id))
    expect(racks.size).toBe(4)
  })
})

describe('constants', () => {
  it('SERVERS has 20 entries', () => expect(SERVERS).toHaveLength(20))
  it('CRAC_UNITS has 4 entries', () => expect(CRAC_UNITS).toHaveLength(4))
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --testPathPattern=telemetry-sim
```

Expected: `Cannot find module '@/lib/telemetry-sim'`

- [ ] **Step 3: Implement telemetry-sim.ts**

Create `lib/telemetry-sim.ts`:

```typescript
import type { ServerTelemetry, CoolingState, EnergyPrice, WorkloadType } from './types'

export const SERVERS = Array.from({ length: 20 }, (_, i) => ({
  id: `srv-${String(i + 1).padStart(2, '0')}`,
  rack: `rack-${'ABCD'[Math.floor(i / 5)]}`,
}))

export const CRAC_UNITS = ['crac-1', 'crac-2', 'crac-3', 'crac-4']

// Deterministic pseudo-random from a numeric seed
function seededNoise(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

function getAmbientTemp(hour: number): number {
  return 20 + 8 * Math.sin(((hour - 6) * Math.PI) / 12)
}

function getWorkload(serverIndex: number, hour: number): WorkloadType {
  if (serverIndex <= 1 && hour >= 9 && hour < 17) return 'training'
  if (serverIndex >= 15 && (hour < 6 || hour >= 22)) return 'idle'
  return 'inference'
}

export function getPriceAt(hour: number): number {
  let base: number
  if (hour >= 23 || hour < 6) base = 0.05
  else if ((hour >= 6 && hour < 9) || (hour >= 18 && hour < 23)) base = 0.10
  else base = 0.18
  return +(base + (seededNoise(hour * 7) - 0.5) * 0.01).toFixed(4)
}

export function getRenewableAt(hour: number, at: Date): number {
  const doy = Math.floor(at.getTime() / 86400000)
  const solar = Math.max(0, 40 * Math.exp(-((hour - 12) ** 2) / 18))
  const wind = 10 + (seededNoise(doy * 24 + hour) - 0.5) * 10
  return +Math.min(95, solar + wind).toFixed(2)
}

export interface TelemetryTick {
  servers: Omit<ServerTelemetry, 'id'>[]
  cooling: Omit<CoolingState, 'id'>[]
  price: Omit<EnergyPrice, 'id'>
}

export function generateTick(at: Date): TelemetryTick {
  const hour = at.getHours()
  const min = at.getMinutes()
  const seed = Math.floor(at.getTime() / 1000)
  const ambient = getAmbientTemp(hour)

  const servers: Omit<ServerTelemetry, 'id'>[] = SERVERS.map(({ id, rack }, i) => {
    const wt = getWorkload(i, hour)
    const baseCpu = wt === 'training' ? 80 : wt === 'idle' ? 10 : 45
    const s = seed + i * 100 + min
    const cpu = Math.min(100, Math.max(5, baseCpu + (seededNoise(s) - 0.5) * 10 + 5 * Math.sin((hour * Math.PI) / 12)))
    const ram = Math.min(100, Math.max(10, cpu * 0.7 + (seededNoise(s + 1) - 0.5) * 8))
    const temp = Math.min(88, ambient + cpu * 0.55 + (seededNoise(s + 2) - 0.5) * 3)
    const power = 80 + (cpu / 100) * 370 + (seededNoise(s + 3) - 0.5) * 10
    return {
      server_id: id, rack_id: rack,
      cpu_pct: +cpu.toFixed(2), ram_pct: +ram.toFixed(2),
      temp_c: +temp.toFixed(2), power_w: +power.toFixed(2),
      workload_type: wt, is_scheduled: false, timestamp: at.toISOString(),
    }
  })

  const avgTemp = servers.reduce((s, sv) => s + sv.temp_c, 0) / servers.length
  const fanBase = Math.min(100, Math.max(20, (avgTemp - ambient - 5) * 3 + 20))

  const cooling: Omit<CoolingState, 'id'>[] = CRAC_UNITS.map((unit_id, i) => {
    const fan = Math.min(100, fanBase + (seededNoise(seed + i * 7) - 0.5) * 5)
    return {
      unit_id,
      setpoint_c: +(ambient + 5).toFixed(2),
      fan_speed_pct: +fan.toFixed(2),
      power_w: +(500 + (fan / 100) * 3000).toFixed(2),
      timestamp: at.toISOString(),
    }
  })

  return {
    servers,
    cooling,
    price: {
      price_per_kwh: getPriceAt(hour),
      renewable_pct: getRenewableAt(hour, at),
      timestamp: at.toISOString(),
    },
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- --testPathPattern=telemetry-sim
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/telemetry-sim.ts __tests__/telemetry-sim.test.ts
git commit -m "feat: add telemetry simulation library with tests"
```

---

## Task 5: Zod Validation Schemas (TDD)

**Files:**
- Create: `lib/validations.ts`
- Create: `__tests__/validations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/validations.test.ts`:

```typescript
import {
  RecommendationsArraySchema,
  HistoryRangeSchema,
  MetricsQuerySchema,
  AlertPatchSchema,
  RecommendationPatchSchema,
  SchedulerApplySchema,
  ReportBodySchema,
} from '@/lib/validations'

describe('RecommendationsArraySchema', () => {
  it('accepts valid recommendation array', () => {
    const input = [{
      type: 'cooling_adjustment', priority: 'high',
      description: 'Raise setpoint', action: 'Set to 22C',
      estimated_kwh_savings: 10, estimated_usd_savings: 1.2, confidence: 0.85,
    }]
    expect(RecommendationsArraySchema.safeParse(input).success).toBe(true)
  })
  it('rejects invalid type', () => {
    const input = [{ type: 'bad_type', priority: 'high', description: 'x', action: 'x', estimated_kwh_savings: 0, estimated_usd_savings: 0, confidence: 0.5 }]
    expect(RecommendationsArraySchema.safeParse(input).success).toBe(false)
  })
  it('rejects confidence > 1', () => {
    const input = [{ type: 'alert', priority: 'low', description: 'x', action: 'x', estimated_kwh_savings: 0, estimated_usd_savings: 0, confidence: 1.5 }]
    expect(RecommendationsArraySchema.safeParse(input).success).toBe(false)
  })
})

describe('HistoryRangeSchema', () => {
  it('accepts valid ranges', () => {
    expect(HistoryRangeSchema.safeParse('24h').success).toBe(true)
    expect(HistoryRangeSchema.safeParse('7d').success).toBe(true)
    expect(HistoryRangeSchema.safeParse('30d').success).toBe(true)
  })
  it('rejects invalid', () => {
    expect(HistoryRangeSchema.safeParse('1y').success).toBe(false)
  })
})

describe('MetricsQuerySchema', () => {
  it('accepts valid ISO dates', () => {
    const r = MetricsQuerySchema.safeParse({ startDate: '2026-01-01', endDate: '2026-02-01' })
    expect(r.success).toBe(true)
  })
  it('defaults co2Factor to 0.4', () => {
    const r = MetricsQuerySchema.safeParse({ startDate: '2026-01-01', endDate: '2026-02-01' })
    expect(r.success && r.data.co2Factor).toBe(0.4)
  })
})

describe('SchedulerApplySchema', () => {
  it('rejects unknown server IDs', () => {
    const r = SchedulerApplySchema.safeParse({
      assignments: [{ serverId: 'srv-99', hour: 3, workloadType: 'training' }]
    })
    expect(r.success).toBe(false)
  })
  it('accepts valid assignments', () => {
    const r = SchedulerApplySchema.safeParse({
      assignments: [{ serverId: 'srv-01', hour: 3, workloadType: 'training' }]
    })
    expect(r.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --testPathPattern=validations
```

Expected: `Cannot find module '@/lib/validations'`

- [ ] **Step 3: Implement validations.ts**

Create `lib/validations.ts`:

```typescript
import { z } from 'zod'
import { SERVERS } from './telemetry-sim'

const VALID_SERVER_IDS = SERVERS.map(s => s.id) as [string, ...string[]]

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

export const HistoryRangeSchema = z.enum(['24h', '7d', '30d'])

export const MetricsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  co2Factor: z.coerce.number().min(0).max(5).default(0.4),
})

export const AlertPatchSchema = z.object({
  resolved: z.literal(true),
})

export const RecommendationPatchSchema = z.object({
  status: z.enum(['applied', 'dismissed']),
})

export const SchedulerApplySchema = z.object({
  assignments: z.array(z.object({
    serverId: z.enum(VALID_SERVER_IDS),
    hour: z.number().int().min(0).max(23),
    workloadType: z.enum(['inference', 'training', 'idle']),
  })).min(1),
})

export const ReportBodySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  co2Factor: z.number().min(0).max(5).default(0.4),
})
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- --testPathPattern=validations
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/validations.ts __tests__/validations.test.ts
git commit -m "feat: add Zod validation schemas with tests"
```

---

## Task 6: Claude AI Client

**Files:**
- Create: `lib/claude.ts`

- [ ] **Step 1: Create claude.ts**

Create `lib/claude.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY')
}

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const MODEL = 'claude-sonnet-4-6'

export const OPTIMIZATION_SYSTEM_PROMPT = `You are GridMind's AI optimization engine, an expert in data center energy efficiency.
You will receive a JSON snapshot of real-time server telemetry, cooling state, electricity prices, and renewable energy availability.
Analyze the data and return a JSON array of optimization recommendations.
Each recommendation must follow this exact schema:
{ type, priority, description, action, estimated_kwh_savings, estimated_usd_savings, confidence }.
Be specific and quantitative. Focus on the highest-impact opportunities first.
Valid values: type = cooling_adjustment | workload_shift | server_consolidation | alert;
priority = critical | high | medium | low; confidence = 0.0 to 1.0.
Return ONLY the JSON array, no other text.`

export const REPORT_SYSTEM_PROMPT = `You are GridMind's reporting engine. Write concise, professional energy reports suitable for ESG reporting and management review.
You will receive a JSON object of aggregated energy metrics for a data center.
Write exactly 3 paragraphs: (1) performance summary, (2) efficiency highlights and concerns, (3) recommendations for the next period.
Be specific and quantitative. Use professional business language.`
```

- [ ] **Step 2: Commit**

```bash
git add lib/claude.ts
git commit -m "feat: add Anthropic Claude client and system prompts"
```

---

## Task 7: Telemetry Generate + History API Routes

**Files:**
- Create: `app/api/telemetry/generate/route.ts`
- Create: `app/api/telemetry/history/route.ts`

- [ ] **Step 1: Create generate route**

Create `app/api/telemetry/generate/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { generateTick } from '@/lib/telemetry-sim'

const TEMP_THRESHOLD = 80
const POWER_THRESHOLD = 420

export async function POST() {
  try {
    const tick = generateTick(new Date())

    const { error: serverErr } = await supabaseServer
      .from('server_telemetry').insert(tick.servers)
    if (serverErr) throw serverErr

    const { error: coolingErr } = await supabaseServer
      .from('cooling_state').insert(tick.cooling)
    if (coolingErr) throw coolingErr

    const { error: priceErr } = await supabaseServer
      .from('energy_prices').insert([tick.price])
    if (priceErr) throw priceErr

    // Threshold alerts
    const alertRows = tick.servers
      .filter(s => s.temp_c > TEMP_THRESHOLD || s.power_w > POWER_THRESHOLD)
      .map(s => ({
        server_id: s.server_id,
        severity: s.temp_c > TEMP_THRESHOLD ? 'critical' : 'high' as const,
        type: s.temp_c > TEMP_THRESHOLD ? 'temperature' : 'power' as const,
        message: s.temp_c > TEMP_THRESHOLD
          ? `Server ${s.server_id} temperature ${s.temp_c}°C exceeds threshold of ${TEMP_THRESHOLD}°C`
          : `Server ${s.server_id} power draw ${s.power_w}W exceeds threshold of ${POWER_THRESHOLD}W`,
      }))

    if (alertRows.length > 0) {
      await supabaseServer.from('alerts').insert(alertRows)
    }

    return NextResponse.json(tick)
  } catch (err) {
    console.error('generate error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create history route**

Create `app/api/telemetry/history/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { HistoryRangeSchema } from '@/lib/validations'

const RANGE_CONFIG = {
  '24h': { hours: 24,  bucketMs: 60_000 },       // 1-minute buckets
  '7d':  { hours: 168, bucketMs: 3_600_000 },     // 1-hour buckets
  '30d': { hours: 720, bucketMs: 21_600_000 },    // 6-hour buckets
}

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range') ?? '24h'
  const parsed = HistoryRangeSchema.safeParse(range)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 })
  }

  const { hours, bucketMs } = RANGE_CONFIG[parsed.data]
  const since = new Date(Date.now() - hours * 3_600_000).toISOString()

  // Fetch server and cooling data in parallel
  const [serverRes, coolingRes] = await Promise.all([
    supabaseServer
      .from('server_telemetry')
      .select('timestamp, power_w')
      .gte('timestamp', since)
      .eq('is_scheduled', false)
      .order('timestamp', { ascending: true }),
    supabaseServer
      .from('cooling_state')
      .select('timestamp, power_w')
      .gte('timestamp', since)
      .order('timestamp', { ascending: true }),
  ])

  if (serverRes.error) return NextResponse.json({ error: serverRes.error.message }, { status: 500 })
  if (coolingRes.error) return NextResponse.json({ error: coolingRes.error.message }, { status: 500 })

  // Client-side bucketing with real cooling data
  type Bucket = { serverKw: number; coolingKw: number }
  const buckets = new Map<number, Bucket>()
  const slot = (ts: string) => Math.floor(new Date(ts).getTime() / bucketMs) * bucketMs

  for (const row of serverRes.data ?? []) {
    const t = slot(row.timestamp)
    const b = buckets.get(t) ?? { serverKw: 0, coolingKw: 0 }
    b.serverKw += row.power_w / 1000
    buckets.set(t, b)
  }

  for (const row of coolingRes.data ?? []) {
    const t = slot(row.timestamp)
    const b = buckets.get(t) ?? { serverKw: 0, coolingKw: 0 }
    b.coolingKw += row.power_w / 1000
    buckets.set(t, b)
  }

  const result = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([t, b]) => {
      const totalKw = b.serverKw + b.coolingKw
      const pue = b.serverKw > 0 ? totalKw / b.serverKw : 1.0
      return {
        timestamp: new Date(t).toISOString(),
        total_kw: +totalKw.toFixed(2),
        cooling_kw: +b.coolingKw.toFixed(2),
        pue: +pue.toFixed(3),
      }
    })

  return NextResponse.json(result)
}
```

- [ ] **Step 3: Verify routes respond**

Start dev server (`npm run dev`) and test:
```bash
curl -X POST http://localhost:3000/api/telemetry/generate | head -c 200
curl "http://localhost:3000/api/telemetry/history?range=24h" | head -c 200
```

Expected: JSON responses, no 500 errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/telemetry/
git commit -m "feat: add telemetry generate and history API routes"
```

---

## Task 8: Cooling, Prices, and Seed Routes

**Files:**
- Create: `app/api/cooling/route.ts`
- Create: `app/api/prices/route.ts`
- Create: `app/api/seed/route.ts`

- [ ] **Step 1: Create cooling route**

Create `app/api/cooling/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const { data, error } = await supabaseServer
    .from('cooling_state')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(4) // one per unit, most recent

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Deduplicate: one row per unit_id
  const seen = new Set<string>()
  const latest = (data ?? []).filter(row => {
    if (seen.has(row.unit_id)) return false
    seen.add(row.unit_id)
    return true
  })

  return NextResponse.json(latest)
}
```

- [ ] **Step 2: Create prices route**

Create `app/api/prices/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const { data, error } = await supabaseServer
    .from('energy_prices')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Create seed route**

Create `app/api/seed/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { generateTick } from '@/lib/telemetry-sim'

const CHUNK_SIZE = 200 // ticks per batch
const DAYS = 7
const INTERVAL_SECONDS = 30

export async function POST() {
  // Check if already seeded
  const { count } = await supabaseServer
    .from('server_telemetry')
    .select('*', { count: 'exact', head: true })

  if ((count ?? 0) > 0) {
    return NextResponse.json({ skipped: true, existing: count })
  }

  const now = Date.now()
  const totalTicks = (DAYS * 24 * 3600) / INTERVAL_SECONDS
  let seeded = 0

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = totalTicks - 1; i >= 0; i -= CHUNK_SIZE) {
        const chunkTicks = []
        for (let j = Math.min(CHUNK_SIZE - 1, i); j >= 0 && chunkTicks.length < CHUNK_SIZE; j--) {
          const at = new Date(now - (i - (CHUNK_SIZE - 1 - chunkTicks.length)) * INTERVAL_SECONDS * 1000)
          chunkTicks.push(generateTick(at))
        }

        const serverRows = chunkTicks.flatMap(t => t.servers)
        const coolingRows = chunkTicks.flatMap(t => t.cooling)
        const priceRows = chunkTicks.map(t => t.price)

        const { error: sErr } = await supabaseServer.from('server_telemetry').insert(serverRows)
        if (sErr) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: sErr.message }) + '\n'))
          controller.close()
          return
        }
        await supabaseServer.from('cooling_state').insert(coolingRows)
        await supabaseServer.from('energy_prices').insert(priceRows)

        seeded += chunkTicks.length
        controller.enqueue(encoder.encode(
          JSON.stringify({ progress: seeded, total: totalTicks }) + '\n'
        ))
      }

      controller.enqueue(encoder.encode(
        JSON.stringify({ done: true, seeded }) + '\n'
      ))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/cooling/ app/api/prices/ app/api/seed/
git commit -m "feat: add cooling, prices, and seed API routes"
```

---

## Task 9: AI Optimize and Report Routes

**Files:**
- Create: `app/api/ai/optimize/route.ts`
- Create: `app/api/ai/report/route.ts`

- [ ] **Step 1: Create AI optimize route**

Create `app/api/ai/optimize/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { anthropic, MODEL, OPTIMIZATION_SYSTEM_PROMPT } from '@/lib/claude'
import { RecommendationsArraySchema } from '@/lib/validations'
import { SERVERS } from '@/lib/telemetry-sim'

export async function POST() {
  try {
    // Fetch latest live row per server
    const serverRows = await Promise.all(
      SERVERS.map(({ id }) =>
        supabaseServer
          .from('server_telemetry')
          .select('*')
          .eq('server_id', id)
          .eq('is_scheduled', false)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single()
          .then(r => r.data)
      )
    )

    const { data: cooling } = await supabaseServer
      .from('cooling_state')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(4)

    const { data: price } = await supabaseServer
      .from('energy_prices')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    const snapshot = {
      servers: serverRows.filter(Boolean),
      cooling: cooling ?? [],
      price,
      analyzed_at: new Date().toISOString(),
    }

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: OPTIMIZATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(snapshot) }],
    })

    const text = message.content.find(b => b.type === 'text')?.text ?? ''

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { error: 'Claude returned non-JSON', raw: text.slice(0, 500) },
        { status: 422 }
      )
    }

    const result = RecommendationsArraySchema.safeParse(parsed)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid AI response schema', details: result.error.format(), raw: text.slice(0, 500) },
        { status: 422 }
      )
    }

    const { data: inserted, error: insertErr } = await supabaseServer
      .from('ai_recommendations')
      .insert(result.data)
      .select()

    if (insertErr) throw insertErr
    return NextResponse.json(inserted)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: String(err) }, { status })
  }
}
```

- [ ] **Step 2: Create AI report route**

Create `app/api/ai/report/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { anthropic, MODEL, REPORT_SYSTEM_PROMPT } from '@/lib/claude'
import { ReportBodySchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = ReportBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.format() }, { status: 400 })
  }

  const { startDate, endDate, co2Factor } = parsed.data

  // Fetch aggregate metrics
  const { data: serverData } = await supabaseServer
    .from('server_telemetry')
    .select('power_w, timestamp')
    .gte('timestamp', startDate)
    .lte('timestamp', endDate)
    .eq('is_scheduled', false)

  const { data: priceData } = await supabaseServer
    .from('energy_prices')
    .select('price_per_kwh, renewable_pct')
    .gte('timestamp', startDate)
    .lte('timestamp', endDate)

  const intervalHours = 30 / 3600
  const totalKwh = (serverData ?? []).reduce((s, r) => s + r.power_w / 1000 * intervalHours, 0)
  const avgPrice = priceData && priceData.length > 0
    ? priceData.reduce((s, r) => s + r.price_per_kwh, 0) / priceData.length
    : 0.12
  const avgRenewable = priceData && priceData.length > 0
    ? priceData.reduce((s, r) => s + r.renewable_pct, 0) / priceData.length
    : 20

  const metrics = {
    period: { start: startDate, end: endDate },
    total_kwh: +totalKwh.toFixed(2),
    total_cost_usd: +(totalKwh * avgPrice).toFixed(2),
    total_co2_kg: +(totalKwh * co2Factor * (1 - avgRenewable / 100)).toFixed(2),
    avg_renewable_pct: +avgRenewable.toFixed(1),
    avg_price_per_kwh: +avgPrice.toFixed(4),
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: REPORT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(metrics) }],
  })

  const summary = message.content.find(b => b.type === 'text')?.text ?? ''
  return NextResponse.json({ summary, metrics })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/ai/
git commit -m "feat: add AI optimize and report API routes"
```

---

## Task 10: Alerts, Recommendations, Scheduler, and Reports Metrics Routes

**Files:**
- Create: `app/api/alerts/route.ts`
- Create: `app/api/alerts/[id]/route.ts`
- Create: `app/api/recommendations/route.ts`
- Create: `app/api/recommendations/[id]/route.ts`
- Create: `app/api/scheduler/route.ts`
- Create: `app/api/scheduler/apply/route.ts`
- Create: `app/api/reports/metrics/route.ts`

- [ ] **Step 1: Alerts routes**

Create `app/api/alerts/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  let query = supabaseServer.from('alerts').select('*').order('created_at', { ascending: false })

  const severity = searchParams.get('severity')
  const type = searchParams.get('type')
  const resolved = searchParams.get('resolved')

  if (severity) query = query.eq('severity', severity)
  if (type) query = query.eq('type', type)
  if (resolved !== null) query = query.eq('resolved', resolved === 'true')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

Create `app/api/alerts/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseServer
    .from('alerts')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Recommendations routes**

Create `app/api/recommendations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  let query = supabaseServer.from('ai_recommendations').select('*').order('created_at', { ascending: false })

  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sorted = (data ?? []).sort((a, b) =>
    (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 4) -
    (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 4)
  )

  return NextResponse.json(sorted)
}
```

Create `app/api/recommendations/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { RecommendationPatchSchema } from '@/lib/validations'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null)
  const parsed = RecommendationPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.format() }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('ai_recommendations')
    .update({ status: parsed.data.status })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Scheduler routes**

Create `app/api/scheduler/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getPriceAt, getRenewableAt } from '@/lib/telemetry-sim'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET() {
  const now = new Date()
  const hours = Array.from({ length: 24 }, (_, h) => h)

  const priceData = hours.map(h => ({ hour: h, price: getPriceAt(h) }))
  const renewableData = hours.map(h => ({ hour: h, renewable: getRenewableAt(h, now) }))

  const optimalWindows = hours.filter(h => getPriceAt(h) < 0.08 && getRenewableAt(h, now) > 30)

  // Current workload distribution from last tick
  const since = new Date(Date.now() - 35000).toISOString()
  const { data: recent } = await supabaseServer
    .from('server_telemetry')
    .select('workload_type')
    .gte('timestamp', since)
    .eq('is_scheduled', false)

  const workloadCounts = { inference: 0, training: 0, idle: 0 }
  for (const row of (recent ?? [])) {
    workloadCounts[row.workload_type as keyof typeof workloadCounts]++
  }

  return NextResponse.json({ priceData, renewableData, optimalWindows, workloadCounts })
}
```

Create `app/api/scheduler/apply/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { SchedulerApplySchema } from '@/lib/validations'
import { getPriceAt, SERVERS } from '@/lib/telemetry-sim'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = SchedulerApplySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.format() }, { status: 400 })
  }

  const today = new Date()
  today.setMinutes(0, 0, 0)

  const rows = parsed.data.assignments.map(({ serverId, hour, workloadType }) => {
    const server = SERVERS.find(s => s.id === serverId)!
    const ts = new Date(today)
    ts.setHours(hour)
    return {
      server_id: serverId,
      rack_id: server.rack,
      cpu_pct: workloadType === 'training' ? 85 : workloadType === 'idle' ? 10 : 50,
      ram_pct: workloadType === 'training' ? 75 : workloadType === 'idle' ? 15 : 45,
      temp_c: workloadType === 'training' ? 72 : workloadType === 'idle' ? 30 : 55,
      power_w: workloadType === 'training' ? 390 : workloadType === 'idle' ? 90 : 210,
      workload_type: workloadType,
      is_scheduled: true,
      timestamp: ts.toISOString(),
    }
  })

  // beforeCost: what these workloads would cost if run right now (current price)
  // afterCost: what they'll cost at each assignment's scheduled hour
  const currentHour = new Date().getHours()
  const beforeCost = rows.reduce((s, r) => s + (r.power_w / 1000) * getPriceAt(currentHour), 0)
  const afterCost = rows.reduce((s, r) => s + (r.power_w / 1000) * getPriceAt(new Date(r.timestamp).getHours()), 0)

  const { error } = await supabaseServer.from('server_telemetry').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    applied: rows.length,
    beforeCost: +beforeCost.toFixed(4),
    afterCost: +afterCost.toFixed(4),
    savingsUsd: +(beforeCost - afterCost).toFixed(4),
  })
}
```

- [ ] **Step 4: Reports metrics route**

Create `app/api/reports/metrics/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { MetricsQuerySchema } from '@/lib/validations'

async function computeMetrics(start: string, end: string, co2Factor: number) {
  const { data: servers } = await supabaseServer
    .from('server_telemetry')
    .select('power_w, timestamp')
    .gte('timestamp', start)
    .lte('timestamp', end)
    .eq('is_scheduled', false)

  const { data: cooling } = await supabaseServer
    .from('cooling_state')
    .select('power_w')
    .gte('timestamp', start)
    .lte('timestamp', end)

  const { data: prices } = await supabaseServer
    .from('energy_prices')
    .select('price_per_kwh, renewable_pct')
    .gte('timestamp', start)
    .lte('timestamp', end)

  const intervalHours = 30 / 3600
  const serverKwh = (servers ?? []).reduce((s, r) => s + r.power_w / 1000 * intervalHours, 0)
  const coolingKwh = (cooling ?? []).reduce((s, r) => s + r.power_w / 1000 * intervalHours, 0)
  const totalKwh = serverKwh + coolingKwh
  const avgPue = serverKwh > 0 ? (serverKwh + coolingKwh) / serverKwh : 1.0

  const n = prices?.length ?? 1
  const avgPrice = (prices ?? []).reduce((s, r) => s + r.price_per_kwh, 0) / Math.max(n, 1)
  const avgRenewable = (prices ?? []).reduce((s, r) => s + r.renewable_pct, 0) / Math.max(n, 1)

  const buckets = new Map<string, number>()
  for (const r of (servers ?? [])) {
    const hour = r.timestamp.slice(0, 13)
    buckets.set(hour, (buckets.get(hour) ?? 0) + r.power_w / 1000)
  }
  const peakKw = Math.max(0, ...buckets.values())

  return {
    total_kwh: +totalKwh.toFixed(2),
    avg_pue: +avgPue.toFixed(3),
    peak_kw: +peakKw.toFixed(2),
    total_cost_usd: +(totalKwh * avgPrice).toFixed(2),
    total_co2_kg: +(totalKwh * co2Factor * (1 - avgRenewable / 100)).toFixed(2),
    renewable_pct: +avgRenewable.toFixed(1),
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const parsed = MetricsQuerySchema.safeParse({
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    co2Factor: searchParams.get('co2Factor'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid params', details: parsed.error.format() }, { status: 400 })
  }

  const { startDate, endDate, co2Factor } = parsed.data
  const rangeMs = new Date(endDate).getTime() - new Date(startDate).getTime()
  const priorEnd = startDate
  const priorStart = new Date(new Date(startDate).getTime() - rangeMs).toISOString().slice(0, 10)

  const [current, prior] = await Promise.all([
    computeMetrics(startDate, endDate, co2Factor),
    computeMetrics(priorStart, priorEnd, co2Factor),
  ])

  return NextResponse.json({ current, prior })
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/alerts/ app/api/recommendations/ app/api/scheduler/ app/api/reports/
git commit -m "feat: add alerts, recommendations, scheduler, and reports API routes"
```

---

## Task 11: App Shell — Globals, Root Layout, Dashboard Layout

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `app/(dashboard)/layout.tsx`
- Create: `components/shared/StatusIndicator.tsx`
- Create: `components/shared/Nav.tsx`

- [ ] **Step 1: Update globals.css with dark theme**

Replace `app/globals.css` content:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 15 23 42;   /* slate-950 */
  --foreground: 226 232 240; /* slate-200 */
}

body {
  background-color: rgb(var(--background));
  color: rgb(var(--foreground));
  font-family: var(--font-geist-sans), sans-serif;
}

@layer utilities {
  .gradient-blue { background: linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%); }
  .gradient-green { background: linear-gradient(135deg, #064e3b 0%, #1e293b 100%); }
  .gradient-amber { background: linear-gradient(135deg, #78350f 0%, #1e293b 100%); }
  .gradient-red   { background: linear-gradient(135deg, #7f1d1d 0%, #1e293b 100%); }

  .animate-pulse-slow {
    animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
}
```

- [ ] **Step 2: Update root layout**

Replace `app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'GridMind — Data Center Energy Optimization',
  description: 'AI-powered energy management for data centers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-slate-950 text-slate-200 antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Create StatusIndicator**

Create `components/shared/StatusIndicator.tsx`:

```typescript
'use client'

export function StatusIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
      </span>
      <span className="text-emerald-400 font-medium">System Status: Nominal</span>
    </div>
  )
}
```

- [ ] **Step 4: Create Nav**

Create `components/shared/Nav.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { StatusIndicator } from './StatusIndicator'
import { Zap } from 'lucide-react'

const NAV_LINKS = [
  { href: '/',           label: 'Dashboard' },
  { href: '/optimize',   label: 'Optimize' },
  { href: '/scheduler',  label: 'Scheduler' },
  { href: '/reports',    label: 'Reports' },
  { href: '/alerts',     label: 'Alerts' },
  { href: '/settings',   label: 'Settings' },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur border-b border-slate-800">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white">
          <Zap className="w-5 h-5 text-blue-400" fill="currentColor" />
          GridMind
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <StatusIndicator />
      </div>
    </nav>
  )
}
```

- [ ] **Step 5: Create dashboard layout**

Create `app/(dashboard)/layout.tsx`:

```typescript
import { Nav } from '@/components/shared/Nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950">
      <Nav />
      <main className="max-w-screen-2xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/layout.tsx app/(dashboard)/layout.tsx components/shared/
git commit -m "feat: add app shell, dark theme, nav, and status indicator"
```

---

## Task 12: Dashboard Components

**Files:**
- Create: `components/dashboard/MetricCard.tsx`
- Create: `components/dashboard/RackHeatmap.tsx`
- Create: `components/dashboard/PowerChart.tsx`
- Create: `components/dashboard/InsightFeed.tsx`

- [ ] **Step 1: MetricCard**

Create `components/dashboard/MetricCard.tsx`:

```typescript
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  trend?: 'up' | 'down' | 'neutral'
  variant?: 'blue' | 'green' | 'amber' | 'red'
}

const VARIANTS = {
  blue:   { card: 'gradient-blue border-blue-800/50',   value: 'text-blue-300' },
  green:  { card: 'gradient-green border-emerald-800/50', value: 'text-emerald-300' },
  amber:  { card: 'gradient-amber border-amber-800/50',  value: 'text-amber-300' },
  red:    { card: 'gradient-red border-red-800/50',      value: 'text-red-300' },
}

export function MetricCard({ label, value, unit, variant = 'blue' }: MetricCardProps) {
  const v = VARIANTS[variant]
  return (
    <div className={cn('rounded-xl border p-4 flex flex-col gap-1', v.card)}>
      <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums', v.value)}>
        {value}
        {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: RackHeatmap**

Create `components/dashboard/RackHeatmap.tsx`:

```typescript
import type { ServerTelemetry } from '@/lib/types'
import { cn } from '@/lib/utils'

function tempColor(temp: number): string {
  if (temp >= 75) return 'bg-red-500 text-white'
  if (temp >= 65) return 'bg-amber-500 text-black'
  if (temp >= 55) return 'bg-yellow-400 text-black'
  return 'bg-emerald-500 text-white'
}

interface Props { servers: ServerTelemetry[] }

export function RackHeatmap({ servers }: Props) {
  const racks = ['rack-A', 'rack-B', 'rack-C', 'rack-D']
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-400 mb-3">Server Rack Heatmap</h3>
      <div className="grid grid-cols-4 gap-3">
        {racks.map(rack => (
          <div key={rack}>
            <p className="text-xs text-slate-500 mb-1 text-center">{rack}</p>
            <div className="grid grid-cols-1 gap-1">
              {servers
                .filter(s => s.rack_id === rack)
                .map(s => (
                  <div
                    key={s.server_id}
                    title={`${s.server_id}: ${s.temp_c}°C | ${s.cpu_pct}% CPU | ${s.workload_type}`}
                    className={cn(
                      'rounded text-[10px] font-mono px-1 py-0.5 text-center cursor-default transition-colors',
                      tempColor(s.temp_c)
                    )}
                  >
                    {s.server_id.slice(-2)} {s.temp_c}°
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-slate-500">
        <span><span className="inline-block w-2 h-2 bg-emerald-500 rounded-sm mr-1" />Cool (&lt;55°C)</span>
        <span><span className="inline-block w-2 h-2 bg-yellow-400 rounded-sm mr-1" />Warm (55–65°C)</span>
        <span><span className="inline-block w-2 h-2 bg-amber-500 rounded-sm mr-1" />Hot (65–75°C)</span>
        <span><span className="inline-block w-2 h-2 bg-red-500 rounded-sm mr-1" />Critical (&gt;75°C)</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: PowerChart**

Create `components/dashboard/PowerChart.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { HistoryBucket } from '@/lib/types'

type Range = '24h' | '7d' | '30d'

export function PowerChart() {
  const [range, setRange] = useState<Range>('24h')
  const [data, setData] = useState<HistoryBucket[]>([])

  useEffect(() => {
    fetch(`/api/telemetry/history?range=${range}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
  }, [range])

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-400">Power Consumption</h3>
        <div className="flex gap-1">
          {(['24h', '7d', '30d'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-1 text-xs rounded ${range === r ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: '#64748b' }}
            tickFormatter={v => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} unit=" kW" />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }}
            formatter={(v: number) => [`${v.toFixed(1)} kW`]}
          />
          <Line type="monotone" dataKey="total_kw" stroke="#3b82f6" dot={false} strokeWidth={2} name="IT Power" />
          <Line type="monotone" dataKey="cooling_kw" stroke="#10b981" dot={false} strokeWidth={1.5} name="Cooling" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: InsightFeed**

Create `components/dashboard/InsightFeed.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import type { AiRecommendation } from '@/lib/types'
import { cn } from '@/lib/utils'

const PRIORITY_STYLES = {
  critical: 'bg-red-500/10 border-red-500/30 text-red-400',
  high:     'bg-amber-500/10 border-amber-500/30 text-amber-400',
  medium:   'bg-blue-500/10 border-blue-500/30 text-blue-400',
  low:      'bg-slate-500/10 border-slate-500/30 text-slate-400',
}

export function InsightFeed() {
  const [items, setItems] = useState<AiRecommendation[]>([])

  useEffect(() => {
    const load = () =>
      fetch('/api/recommendations?status=pending')
        .then(r => r.json())
        .then(setItems)
        .catch(console.error)
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 h-full flex flex-col">
      <h3 className="text-sm font-medium text-slate-400 mb-3">AI Insights</h3>
      <div className="flex-1 overflow-y-auto space-y-2 max-h-80">
        {items.length === 0 ? (
          <p className="text-xs text-slate-600 text-center pt-8">Run AI analysis to see recommendations</p>
        ) : (
          items.slice(0, 10).map(item => (
            <div key={item.id} className={cn('rounded-lg border p-2.5 text-xs', PRIORITY_STYLES[item.priority])}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold uppercase tracking-wide">{item.priority}</span>
                <span className="text-slate-500">{item.type.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-slate-300 line-clamp-2">{item.description}</p>
              {item.estimated_usd_savings > 0 && (
                <p className="text-emerald-400 mt-1">Est. savings: ${item.estimated_usd_savings}/mo</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/
git commit -m "feat: add dashboard components (MetricCard, RackHeatmap, PowerChart, InsightFeed)"
```

---

## Task 13: Dashboard Page

**Files:**
- Create: `app/(dashboard)/page.tsx`

- [ ] **Step 1: Create dashboard page**

Create `app/(dashboard)/page.tsx`:

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { RackHeatmap } from '@/components/dashboard/RackHeatmap'
import { PowerChart } from '@/components/dashboard/PowerChart'
import { InsightFeed } from '@/components/dashboard/InsightFeed'
import type { TelemetrySnapshot, GridMindSettings } from '@/lib/types'
import { DEFAULT_SETTINGS } from '@/lib/types'

function getSettings(): GridMindSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    return JSON.parse(localStorage.getItem('gridmind_settings') ?? 'null') ?? DEFAULT_SETTINGS
  } catch { return DEFAULT_SETTINGS }
}

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedProgress, setSeedProgress] = useState(0)
  const settings = getSettings()

  const fetchTick = useCallback(async () => {
    const res = await fetch('/api/telemetry/generate', { method: 'POST' })
    const data = await res.json()
    setSnapshot(data)
  }, [])

  useEffect(() => {
    // Check if DB is empty and seed if needed
    const init = async () => {
      const check = await fetch('/api/telemetry/history?range=24h')
      const history = await check.json()
      if (!Array.isArray(history) || history.length === 0) {
        setSeeding(true)
        const res = await fetch('/api/seed', { method: 'POST' })
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const lines = decoder.decode(value).split('\n').filter(Boolean)
            for (const line of lines) {
              try {
                const msg = JSON.parse(line)
                if (msg.progress && msg.total) setSeedProgress(Math.round(msg.progress / msg.total * 100))
              } catch {}
            }
          }
        }
        setSeeding(false)
      }
      fetchTick()
    }
    init()
    const id = setInterval(fetchTick, 30000)
    return () => clearInterval(id)
  }, [fetchTick])

  if (seeding) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-slate-400">Seeding historical data... {seedProgress}%</p>
        <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${seedProgress}%` }} />
        </div>
      </div>
    )
  }

  const servers = snapshot?.servers ?? []
  const cooling = snapshot?.cooling ?? []
  const price = snapshot?.price

  const totalPowerKw = servers.reduce((s, sv) => s + sv.power_w / 1000, 0)
  const coolingPowerKw = cooling.reduce((s, c) => s + c.power_w / 1000, 0)
  const pue = totalPowerKw > 0 ? ((totalPowerKw + coolingPowerKw) / totalPowerKw) : 1.0
  const coolingLoadKw = coolingPowerKw
  const monthlyCost = totalPowerKw * 24 * 30 * settings.electricityCostPerKwh
  const renewablePct = (price?.renewable_pct ?? 20) / 100
  const co2Kg = totalPowerKw * 24 * 30 * settings.co2Factor * (1 - renewablePct)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Operations Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Live telemetry — refreshes every 30s</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Total Power Draw" value={totalPowerKw.toFixed(1)} unit="kW" variant="blue" />
        <MetricCard label="PUE" value={pue.toFixed(3)} variant="green" />
        <MetricCard label="Cooling Load" value={coolingLoadKw.toFixed(1)} unit="kW" variant="blue" />
        <MetricCard label="Est. Monthly Cost" value={`$${monthlyCost.toFixed(0)}`} variant="amber" />
        <MetricCard label="CO₂ Footprint" value={co2Kg.toFixed(0)} unit="kg/mo" variant="red" />
      </div>

      {/* Heatmap + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RackHeatmap servers={servers} />
        </div>
        <InsightFeed />
      </div>

      {/* Power Chart */}
      <PowerChart />
    </div>
  )
}
```

- [ ] **Step 2: Verify dashboard loads**

```bash
npm run dev
```

Open http://localhost:3000. Expected: metrics cards, heatmap, and chart visible. Initial load triggers seed if DB is empty.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/page.tsx
git commit -m "feat: add dashboard page with live telemetry, heatmap, and charts"
```

---

## Task 14: Optimize Page

**Files:**
- Create: `components/optimize/RecommendationCard.tsx`
- Create: `app/(dashboard)/optimize/page.tsx`

- [ ] **Step 1: RecommendationCard**

Create `components/optimize/RecommendationCard.tsx`:

```typescript
'use client'

import type { AiRecommendation } from '@/lib/types'
import { cn } from '@/lib/utils'

const PRIORITY_CONFIG = {
  critical: { border: 'border-red-500/50',   badge: 'bg-red-500/20 text-red-400',   dot: 'bg-red-500' },
  high:     { border: 'border-amber-500/50',  badge: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-500' },
  medium:   { border: 'border-blue-500/50',   badge: 'bg-blue-500/20 text-blue-400',  dot: 'bg-blue-500' },
  low:      { border: 'border-slate-500/50',  badge: 'bg-slate-500/20 text-slate-400', dot: 'bg-slate-500' },
}

interface Props {
  rec: AiRecommendation
  onApply: (id: string) => void
  onDismiss: (id: string) => void
}

export function RecommendationCard({ rec, onApply, onDismiss }: Props) {
  const cfg = PRIORITY_CONFIG[rec.priority]
  return (
    <div className={cn('rounded-xl border bg-slate-900 p-4 space-y-3', cfg.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('px-2 py-0.5 rounded text-xs font-bold uppercase', cfg.badge)}>
            {rec.priority}
          </span>
          <span className="text-xs text-slate-500">{rec.type.replace(/_/g, ' ')}</span>
        </div>
        <span className="text-xs text-slate-500">{Math.round(rec.confidence * 100)}% confidence</span>
      </div>

      <p className="text-sm text-slate-200">{rec.description}</p>

      <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300 border-l-2 border-blue-500">
        <span className="text-blue-400 font-semibold">Action: </span>{rec.action}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-xs">
          <span className="text-emerald-400">
            {rec.estimated_kwh_savings > 0 && `${rec.estimated_kwh_savings} kWh saved`}
          </span>
          <span className="text-emerald-400">
            {rec.estimated_usd_savings > 0 && `$${rec.estimated_usd_savings} saved`}
          </span>
        </div>
        {rec.status === 'pending' && (
          <div className="flex gap-2">
            <button onClick={() => onDismiss(rec.id)} className="text-xs text-slate-500 hover:text-slate-300">
              Dismiss
            </button>
            <button onClick={() => onApply(rec.id)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">
              Apply
            </button>
          </div>
        )}
        {rec.status !== 'pending' && (
          <span className="text-xs text-slate-500 capitalize">{rec.status}</span>
        )}
      </div>

      <div className="w-full bg-slate-800 rounded-full h-1">
        <div className={cn('h-1 rounded-full', cfg.dot)} style={{ width: `${rec.confidence * 100}%` }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Optimize page**

Create `app/(dashboard)/optimize/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { AiRecommendation } from '@/lib/types'
import { RecommendationCard } from '@/components/optimize/RecommendationCard'

export default function OptimizePage() {
  const [recs, setRecs] = useState<AiRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [lastRun, setLastRun] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/optimize', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setRecs(data)
        setLastRun(new Date())
      } else {
        setError(data.error ?? 'Analysis failed')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: string, status: 'applied' | 'dismissed') => {
    await fetch(`/api/recommendations/${id}`, {
      method: 'PATCH', body: JSON.stringify({ status }), headers: { 'Content-Type': 'application/json' },
    })
    setRecs(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Optimization Engine</h1>
          {lastRun && <p className="text-sm text-slate-500 mt-1">Last analysis: {lastRun.toLocaleTimeString()}</p>}
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              GridMind is analyzing...
            </>
          ) : 'Run Analysis'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="h-3 bg-slate-800 rounded w-full" />
              <div className="h-3 bg-slate-800 rounded w-4/5" />
            </div>
          ))}
        </div>
      )}

      {!loading && recs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recs.map(rec => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              onApply={id => updateStatus(id, 'applied')}
              onDismiss={id => updateStatus(id, 'dismissed')}
            />
          ))}
        </div>
      )}

      {!loading && recs.length === 0 && !error && (
        <div className="text-center py-20 text-slate-600">
          <p className="text-lg">Click "Run Analysis" to generate AI recommendations</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/optimize/ app/(dashboard)/optimize/
git commit -m "feat: add optimize page with AI recommendation cards"
```

---

## Task 15: Scheduler Page

**Files:**
- Create: `components/scheduler/Timeline.tsx`
- Create: `app/(dashboard)/scheduler/page.tsx`

- [ ] **Step 1: Timeline component**

Create `components/scheduler/Timeline.tsx`:

```typescript
'use client'

import { ComposedChart, Bar, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts'

interface TimelineData {
  hour: number
  price: number
  renewable: number
  inference: number
  training: number
  idle: number
}

interface Props {
  data: TimelineData[]
  optimalWindows: number[]
}

export function Timeline({ data, optimalWindows }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex gap-4 text-xs text-slate-500 mb-4">
        <span><span className="inline-block w-3 h-1 bg-blue-400 mr-1" />Inference servers</span>
        <span><span className="inline-block w-3 h-1 bg-amber-400 mr-1" />Training servers</span>
        <span><span className="inline-block w-3 h-1 bg-emerald-400 mr-1" />Price ($/kWh)</span>
        <span><span className="inline-block w-3 h-1 bg-green-700 mr-1 opacity-50" />Optimal window</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={h => `${h}:00`} />
          <YAxis yAxisId="servers" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Servers', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 10 } }} />
          <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `$${v.toFixed(2)}`} />
          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
          {optimalWindows.map(h => (
            <ReferenceArea key={h} yAxisId="servers" x1={h} x2={h + 1} fill="#16a34a" fillOpacity={0.15} />
          ))}
          <Bar yAxisId="servers" dataKey="inference" fill="#3b82f6" stackId="a" />
          <Bar yAxisId="servers" dataKey="training" fill="#f59e0b" stackId="a" />
          <Bar yAxisId="servers" dataKey="idle" fill="#475569" stackId="a" />
          <Line yAxisId="price" type="monotone" dataKey="price" stroke="#10b981" dot={false} strokeWidth={2} />
          <Area yAxisId="price" type="monotone" dataKey="renewable" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.05} strokeWidth={1} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Scheduler page**

Create `app/(dashboard)/scheduler/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Timeline } from '@/components/scheduler/Timeline'

interface SchedulerData {
  priceData: { hour: number; price: number }[]
  renewableData: { hour: number; renewable: number }[]
  optimalWindows: number[]
  workloadCounts: { inference: number; training: number; idle: number }
}

export default function SchedulerPage() {
  const [data, setData] = useState<SchedulerData | null>(null)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<{ beforeCost: number; afterCost: number; savingsUsd: number } | null>(null)

  useEffect(() => {
    fetch('/api/scheduler').then(r => r.json()).then(setData).catch(console.error)
  }, [])

  const applySchedule = async () => {
    if (!data) return
    setApplying(true)
    // Suggest moving inference servers to optimal windows
    const assignments = data.optimalWindows.slice(0, 3).map((hour, i) => ({
      serverId: `srv-${String(i + 3).padStart(2, '0')}`,
      hour,
      workloadType: 'training' as const,
    }))
    const res = await fetch('/api/scheduler/apply', {
      method: 'POST',
      body: JSON.stringify({ assignments }),
      headers: { 'Content-Type': 'application/json' },
    })
    const r = await res.json()
    if (res.ok) setResult(r)
    setApplying(false)
  }

  const timelineData = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    price: data?.priceData.find(p => p.hour === h)?.price ?? 0,
    renewable: data?.renewableData.find(p => p.hour === h)?.renewable ?? 0,
    inference: h >= 9 && h < 17 ? 15 : 12,
    training: h >= 9 && h < 17 ? 3 : 1,
    idle: h >= 9 && h < 17 ? 2 : 7,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Workload Scheduler</h1>
          <p className="text-sm text-slate-500 mt-1">
            Green bands = optimal windows (low price + high renewable)
          </p>
        </div>
        <button
          onClick={applySchedule}
          disabled={applying || !data}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm"
        >
          {applying ? 'Applying...' : 'Apply AI Schedule'}
        </button>
      </div>

      {result && (
        <div className="bg-emerald-900/20 border border-emerald-800 rounded-xl p-4 grid grid-cols-3 gap-4 text-sm">
          <div><p className="text-slate-400">Before</p><p className="text-lg font-bold text-white">${result.beforeCost.toFixed(4)}/h</p></div>
          <div><p className="text-slate-400">After</p><p className="text-lg font-bold text-white">${result.afterCost.toFixed(4)}/h</p></div>
          <div><p className="text-slate-400">Savings</p><p className="text-lg font-bold text-emerald-400">${result.savingsUsd.toFixed(4)}/h</p></div>
        </div>
      )}

      <Timeline data={timelineData} optimalWindows={data?.optimalWindows ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/scheduler/ app/(dashboard)/scheduler/
git commit -m "feat: add scheduler page with 24h timeline and AI schedule apply"
```

---

## Task 16: Reports Page

**Files:**
- Create: `app/(dashboard)/reports/page.tsx`

- [ ] **Step 1: Create reports page**

Create `app/(dashboard)/reports/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { MetricsResponse, GridMindSettings } from '@/lib/types'
import { DEFAULT_SETTINGS } from '@/lib/types'

function getSettings(): GridMindSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try { return JSON.parse(localStorage.getItem('gridmind_settings') ?? 'null') ?? DEFAULT_SETTINGS }
  catch { return DEFAULT_SETTINGS }
}

function trend(current: number, prior: number): string {
  if (prior === 0) return '—'
  const pct = ((current - prior) / prior * 100).toFixed(1)
  return `${current >= prior ? '+' : ''}${pct}%`
}

function trendColor(current: number, prior: number, lowerIsBetter = true): string {
  if (prior === 0) return 'text-slate-400'
  const better = lowerIsBetter ? current < prior : current > prior
  return better ? 'text-emerald-400' : 'text-red-400'
}

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const loadMetrics = async () => {
    setLoading(true)
    const settings = getSettings()
    const res = await fetch(`/api/reports/metrics?startDate=${startDate}&endDate=${endDate}&co2Factor=${settings.co2Factor}`)
    const data = await res.json()
    setMetrics(data)
    setLoading(false)
  }

  const generateSummary = async () => {
    setSummaryLoading(true)
    const settings = getSettings()
    const res = await fetch('/api/ai/report', {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate, co2Factor: settings.co2Factor }),
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    setSummary(data.summary)
    setSummaryLoading(false)
  }

  const c = metrics?.current
  const p = metrics?.prior

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Energy Reports</h1>

      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={loadMetrics} disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
          {loading ? 'Loading...' : 'Load Report'}
        </button>
      </div>

      {c && p && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total kWh', curr: c.total_kwh, prior: p.total_kwh, unit: 'kWh', lower: true },
              { label: 'Avg PUE', curr: c.avg_pue, prior: p.avg_pue, unit: '', lower: true },
              { label: 'Peak Load', curr: c.peak_kw, prior: p.peak_kw, unit: 'kW', lower: true },
              { label: 'Total Cost', curr: c.total_cost_usd, prior: p.total_cost_usd, unit: '$', lower: true },
              { label: 'CO₂', curr: c.total_co2_kg, prior: p.total_co2_kg, unit: 'kg', lower: true },
              { label: 'Renewable %', curr: c.renewable_pct, prior: p.renewable_pct, unit: '%', lower: false },
            ].map(({ label, curr, prior, unit, lower }) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-xl font-bold text-white mt-1">{curr.toFixed(1)}{unit}</p>
                <p className={`text-xs mt-1 ${trendColor(curr, prior, lower)}`}>
                  {trend(curr, prior)} vs prior period
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button onClick={generateSummary} disabled={summaryLoading}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              {summaryLoading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />GridMind is writing...</>
              ) : 'Generate AI Summary'}
            </button>
          </div>

          {summary && (
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
              <h3 className="text-sm font-semibold text-blue-400 mb-4 uppercase tracking-wide">Executive Summary</h3>
              <div className="prose prose-invert prose-sm max-w-none">
                {summary.split('\n\n').map((para, i) => (
                  <p key={i} className="text-slate-300 leading-relaxed mb-3">{para}</p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/reports/
git commit -m "feat: add reports page with metrics and AI executive summary"
```

---

## Task 17: Alerts Page

**Files:**
- Create: `app/(dashboard)/alerts/page.tsx`

- [ ] **Step 1: Create alerts page**

Create `app/(dashboard)/alerts/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import type { Alert } from '@/lib/types'
import { cn } from '@/lib/utils'

const SEVERITY_STYLES = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  high:     'bg-amber-500/10 text-amber-400 border-amber-500/30',
  medium:   'bg-blue-500/10 text-blue-400 border-blue-500/30',
  low:      'bg-slate-500/10 text-slate-400 border-slate-500/30',
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ severity: '', type: '', resolved: 'false' })

  const loadAlerts = async () => {
    setLoading(true)
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '')
    )
    const res = await fetch(`/api/alerts?${params}`)
    setAlerts(await res.json())
    setLoading(false)
  }

  useEffect(() => { loadAlerts() }, [filters])

  const resolve = async (id: string) => {
    await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ resolved: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">System Alerts</h1>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        {['', 'critical', 'high', 'medium', 'low'].map(s => (
          <button key={s} onClick={() => setFilters(f => ({ ...f, severity: s }))}
            className={cn('px-3 py-1 rounded-lg text-sm capitalize',
              filters.severity === s ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
            {s || 'All Severities'}
          </button>
        ))}
        <div className="border-l border-slate-700 mx-1" />
        {[['false', 'Open'], ['true', 'Resolved'], ['', 'All']].map(([val, label]) => (
          <button key={val} onClick={() => setFilters(f => ({ ...f, resolved: val }))}
            className={cn('px-3 py-1 rounded-lg text-sm',
              filters.resolved === val ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Server</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-800 animate-pulse">
                  <td colSpan={6} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded" /></td>
                </tr>
              ))
            ) : alerts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-600">No alerts found</td></tr>
            ) : alerts.map(alert => (
              <tr key={alert.id} className={cn('border-b border-slate-800', alert.resolved && 'opacity-50')}>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-0.5 rounded text-xs font-bold uppercase border', SEVERITY_STYLES[alert.severity])}>
                    {alert.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 capitalize">{alert.type}</td>
                <td className="px-4 py-3 font-mono text-slate-300">{alert.server_id ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300 max-w-xs truncate">{alert.message}</td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                  {new Date(alert.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {!alert.resolved && (
                    <button onClick={() => resolve(alert.id)}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">
                      Resolve
                    </button>
                  )}
                  {alert.resolved && <span className="text-xs text-slate-600">Resolved</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/alerts/
git commit -m "feat: add alerts page with filtering and resolve functionality"
```

---

## Task 18: Settings Page

**Files:**
- Create: `app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Create settings page**

Create `app/(dashboard)/settings/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import type { GridMindSettings } from '@/lib/types'
import { DEFAULT_SETTINGS } from '@/lib/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<GridMindSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('gridmind_settings') ?? 'null')
      if (s) setSettings(s)
    } catch {}
  }, [])

  const save = () => {
    localStorage.setItem('gridmind_settings', JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Energy Configuration</h2>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Electricity Cost ($/kWh)</label>
          <input type="number" step="0.001" min="0" max="2" value={settings.electricityCostPerKwh}
            onChange={e => setSettings(s => ({ ...s, electricityCostPerKwh: parseFloat(e.target.value) }))}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm w-full" />
          <p className="text-xs text-slate-500 mt-1">Used to calculate monthly cost and cost savings on the dashboard</p>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">CO₂ Emission Factor (kg/kWh)</label>
          <input type="number" step="0.01" min="0" max="2" value={settings.co2Factor}
            onChange={e => setSettings(s => ({ ...s, co2Factor: parseFloat(e.target.value) }))}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm w-full" />
          <p className="text-xs text-slate-500 mt-1">Applied to all CO₂ calculations including reports and AI summaries</p>
        </div>

        <div className="rounded-lg bg-slate-800 border border-slate-700 p-4 text-sm">
          <p className="text-slate-400 font-medium mb-1">Alert Thresholds (v1 hardcoded)</p>
          <ul className="text-slate-500 text-xs space-y-1">
            <li>• Temperature: 80°C (critical alert)</li>
            <li>• Power draw: 420W per server (high alert)</li>
          </ul>
        </div>

        <div className="rounded-lg bg-slate-800 border border-slate-700 p-4 text-sm">
          <p className="text-slate-400 font-medium mb-1">AI Analysis Frequency</p>
          <p className="text-slate-500 text-xs">Manual (trigger from /optimize page). Scheduled intervals coming in v2.</p>
        </div>
      </div>

      <button onClick={save}
        className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors ${saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/settings/
git commit -m "feat: add settings page with localStorage persistence"
```

---

## Task 19: Final Wiring and Verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Build production bundle**

```bash
npm run build
```

Expected: Build completes with no TypeScript or compilation errors. Fix any type errors before proceeding.

- [ ] **Step 3: Verify all routes respond**

Start dev server and verify each page loads:
- http://localhost:3000 — dashboard with metric cards
- http://localhost:3000/optimize — optimize page
- http://localhost:3000/scheduler — scheduler with timeline
- http://localhost:3000/reports — reports with date picker
- http://localhost:3000/alerts — alerts table
- http://localhost:3000/settings — settings form

Verify each API route:
```bash
curl -X POST http://localhost:3000/api/telemetry/generate -s | jq '.servers | length'
# Expected: 20

curl http://localhost:3000/api/cooling -s | jq 'length'
# Expected: 4

curl http://localhost:3000/api/prices -s | jq '.price_per_kwh'
# Expected: number > 0
```

- [ ] **Step 4: End-to-end AI test**

With valid `ANTHROPIC_API_KEY` in `.env.local`:
```bash
curl -X POST http://localhost:3000/api/ai/optimize -s | jq '.[0].type'
```
Expected: One of `cooling_adjustment`, `workload_shift`, `server_consolidation`, `alert`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete GridMind v1 — all pages and API routes implemented"
```
