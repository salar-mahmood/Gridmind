# GridMind Aesthetic Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the WovenLight hero aesthetic (black bg, Playfair Display headings, glass surfaces, multi-color glows, Framer Motion entrance animations) to all 6 interior app pages.

**Architecture:** Theme layer first (globals, layout, nav, AppShell), then shared components (MetricCard, InsightFeed, RackHeatmap, PowerChart, RecommendationCard), then per-page Playfair headings and stagger wrappers.

**Tech Stack:** Next.js 14, Tailwind CSS, Framer Motion (already installed), next/font/google

---

## Task 1: Global font + background

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add Playfair Display font family to Tailwind config**

In `tailwind.config.ts`, extend the `theme.extend` block to add:
```ts
fontFamily: {
  playfair: ['var(--font-playfair)', 'serif'],
},
```

- [ ] **Step 2: Load Playfair Display via next/font in layout.tsx**

Add to the top of `app/layout.tsx`:
```ts
import { Playfair_Display } from 'next/font/google'

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-playfair',
})
```

Add `playfairDisplay.variable` to the `<html>` className:
```tsx
<html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable}`}>
```

Change body className from `bg-slate-950` to `bg-black`:
```tsx
<body className="min-h-screen bg-black text-slate-200 antialiased">
```

- [ ] **Step 3: Update globals.css body background**

Replace:
```css
:root {
  --background: 15 23 42;
  --foreground: 226 232 240;
}

body {
  background-color: rgb(var(--background));
  color: rgb(var(--foreground));
}
```

With:
```css
:root {
  --background: 0 0 0;
  --foreground: 226 232 240;
}

body {
  background-color: #000;
  color: rgb(var(--foreground));
}
```

Also remove the `.gradient-blue`, `.gradient-green`, `.gradient-amber`, `.gradient-red` utilities — they will no longer be used after MetricCard is updated.

- [ ] **Step 4: Commit**
```bash
git add tailwind.config.ts app/globals.css app/layout.tsx
git commit -m "feat: add Playfair Display font and black background theme"
```

---

## Task 2: Nav + AppShell

**Files:**
- Modify: `components/shared/Nav.tsx`
- Modify: `components/shared/AppShell.tsx`

- [ ] **Step 1: Update Nav to glass style with Playfair logo**

Replace the entire `nav` className and logo in `components/shared/Nav.tsx`:

```tsx
<nav className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/10">
  <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
    <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
      <Zap className="w-5 h-5 text-blue-400" fill="currentColor" />
      <span className="text-xl font-bold text-white font-playfair">GridMind</span>
    </Link>
    <div className="hidden md:flex items-center gap-1">
      {NAV_LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            pathname === href
              ? 'bg-white/10 text-white'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
    <StatusIndicator />
  </div>
</nav>
```

- [ ] **Step 2: Update AppShell with Framer Motion fade + ambient gradient**

Replace `components/shared/AppShell.tsx` with:

```tsx
'use client'

import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Nav } from './Nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHero = pathname === '/'

  if (isHero) return <>{children}</>

  return (
    <>
      <Nav />
      <motion.main
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-screen-2xl mx-auto px-4 py-6"
        style={{
          background: 'radial-gradient(ellipse at top left, rgba(56,189,248,0.04) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(167,139,250,0.04) 0%, transparent 60%)',
        }}
      >
        {children}
      </motion.main>
    </>
  )
}
```

- [ ] **Step 3: Commit**
```bash
git add components/shared/Nav.tsx components/shared/AppShell.tsx
git commit -m "feat: glass nav and ambient gradient AppShell with Framer Motion fade"
```

---

## Task 3: MetricCard — glass + glow variants

**Files:**
- Modify: `components/dashboard/MetricCard.tsx`

- [ ] **Step 1: Replace MetricCard with glass + glow design**

Replace the entire file content:

```tsx
'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  variant?: 'blue' | 'green' | 'amber' | 'red'
  index?: number
}

const VARIANTS = {
  blue:  { border: 'border-blue-500/30',    shadow: 'shadow-blue-500/20',    value: 'text-blue-300' },
  green: { border: 'border-emerald-500/30', shadow: 'shadow-emerald-500/20', value: 'text-emerald-300' },
  amber: { border: 'border-amber-500/30',   shadow: 'shadow-amber-500/20',   value: 'text-amber-300' },
  red:   { border: 'border-red-500/30',     shadow: 'shadow-red-500/20',     value: 'text-red-300' },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.2, 0.65, 0.3, 0.9] } },
}

export function MetricCard({ label, value, unit, variant = 'blue', index = 0 }: MetricCardProps) {
  const v = VARIANTS[variant]
  return (
    <motion.div
      variants={item}
      custom={index}
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-1 bg-white/5 backdrop-blur-md shadow-lg',
        v.border,
        v.shadow
      )}
    >
      <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums', v.value)}>
        {value}
        {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
      </p>
    </motion.div>
  )
}
```

- [ ] **Step 2: Update dashboard page to pass index prop and wrap with stagger container**

In `app/dashboard/page.tsx`, add the stagger container around the MetricCard grid (Task 6 handles the full page — just note that `index` props will be added then).

- [ ] **Step 3: Commit**
```bash
git add components/dashboard/MetricCard.tsx
git commit -m "feat: MetricCard glass surface with colored glow shadows and stagger animation"
```

---

## Task 4: Dashboard shared components

**Files:**
- Modify: `components/dashboard/InsightFeed.tsx`
- Modify: `components/dashboard/RackHeatmap.tsx`
- Modify: `components/dashboard/PowerChart.tsx`

- [ ] **Step 1: Update InsightFeed — glass cards with left accent border**

Replace the outer container and card styles in `components/dashboard/InsightFeed.tsx`:

Container: change `rounded-xl border border-slate-800 bg-slate-900 p-4` → `rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4`

Each item card: change `rounded-lg border p-2.5 text-xs` → `rounded-lg border-l-4 bg-white/5 backdrop-blur-sm p-2.5 text-xs border-r-0 border-t-0 border-b-0`

Update `PRIORITY_STYLES` to use left-border accent colors:
```ts
const PRIORITY_STYLES: Record<string, string> = {
  critical: 'border-l-red-500 text-red-400',
  high:     'border-l-amber-500 text-amber-400',
  medium:   'border-l-blue-500 text-blue-400',
  low:      'border-l-slate-500 text-slate-400',
}
```

- [ ] **Step 2: Update RackHeatmap — glass container + cell glow shadows**

In `components/dashboard/RackHeatmap.tsx`:

Container: change `rounded-xl border border-slate-800 bg-slate-900 p-4` → `rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4`

Update `tempColor` to include glow shadow:
```ts
function tempColor(temp: number): string {
  if (temp >= 75) return 'bg-red-500 text-white shadow-sm shadow-red-500/50'
  if (temp >= 65) return 'bg-amber-500 text-black shadow-sm shadow-amber-500/50'
  if (temp >= 55) return 'bg-yellow-400 text-black shadow-sm shadow-yellow-400/50'
  return 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/50'
}
```

- [ ] **Step 3: Update PowerChart — glass container + glass tooltip**

In `components/dashboard/PowerChart.tsx`:

Container: change `rounded-xl border border-slate-800 bg-slate-900 p-4` → `rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4`

Tooltip contentStyle:
```tsx
contentStyle={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', color: '#e2e8f0' }}
```

CartesianGrid stroke: change `#1e293b` → `rgba(255,255,255,0.05)`

- [ ] **Step 4: Commit**
```bash
git add components/dashboard/InsightFeed.tsx components/dashboard/RackHeatmap.tsx components/dashboard/PowerChart.tsx
git commit -m "feat: glass surfaces for InsightFeed, RackHeatmap, and PowerChart"
```

---

## Task 5: RecommendationCard — glass + priority glow

**Files:**
- Modify: `components/optimize/RecommendationCard.tsx`

- [ ] **Step 1: Update card base and action block**

In `components/optimize/RecommendationCard.tsx`:

Card base: change `rounded-xl border bg-slate-900 p-4 space-y-3` → `rounded-xl border bg-white/5 backdrop-blur-md p-4 space-y-3 border-l-4`

Update `PRIORITY_CONFIG` to use left-border glow accent:
```ts
const PRIORITY_CONFIG: Record<string, { border: string; badge: string; dot: string }> = {
  critical: { border: 'border-l-red-500 border-red-500/20',   badge: 'bg-red-500/20 text-red-400',     dot: 'bg-red-500' },
  high:     { border: 'border-l-amber-500 border-amber-500/20', badge: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-500' },
  medium:   { border: 'border-l-blue-500 border-blue-500/20',  badge: 'bg-blue-500/20 text-blue-400',   dot: 'bg-blue-500' },
  low:      { border: 'border-l-slate-500 border-slate-500/20', badge: 'bg-slate-500/20 text-slate-400', dot: 'bg-slate-500' },
}
```

Action block: change `bg-slate-800 rounded-lg p-3` → `bg-white/5 rounded-lg p-3 border border-white/10`

Confidence bar background: change `bg-slate-800 rounded-full h-1` → `bg-white/10 rounded-full h-1`

- [ ] **Step 2: Commit**
```bash
git add components/optimize/RecommendationCard.tsx
git commit -m "feat: RecommendationCard glass surface with priority left-border glow"
```

---

## Task 6: Dashboard page — Playfair h1 + stagger wrapper

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Add stagger animation and Playfair h1**

Add import at top:
```ts
import { motion } from 'framer-motion'
```

Add animation variants after imports:
```ts
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
```

Wrap the MetricCard grid in a motion.div with the container variant:
```tsx
<motion.div
  variants={container}
  initial="hidden"
  animate="show"
  className="grid grid-cols-2 md:grid-cols-5 gap-3"
>
  <MetricCard label="Total Power Draw" value={totalPowerKw.toFixed(1)} unit="kW" variant="blue" index={0} />
  <MetricCard label="PUE" value={pue.toFixed(3)} variant="green" index={1} />
  <MetricCard label="Cooling Load" value={coolingPowerKw.toFixed(1)} unit="kW" variant="blue" index={2} />
  <MetricCard label="Est. Monthly Cost" value={`$${monthlyCost.toFixed(0)}`} variant="amber" index={3} />
  <MetricCard label="CO₂ Footprint" value={co2Kg.toFixed(0)} unit="kg/mo" variant="red" index={4} />
</motion.div>
```

Update h1:
```tsx
<h1 className="text-2xl font-bold text-white font-playfair">Operations Dashboard</h1>
```

- [ ] **Step 2: Commit**
```bash
git add app/dashboard/page.tsx
git commit -m "feat: dashboard Playfair heading and stagger MetricCard animation"
```

---

## Task 7: Optimize page — Playfair h1 + stagger + glass skeletons

**Files:**
- Modify: `app/optimize/page.tsx`

- [ ] **Step 1: Add motion import and update heading + skeletons + empty state**

Add `import { motion } from 'framer-motion'` and variants:
```ts
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.2, 0.65, 0.3, 0.9] } } }
```

Update h1: `className="text-2xl font-bold text-white font-playfair"`

Wrap recommendation grid in stagger container:
```tsx
<motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {recs.map((rec, i) => (
    <motion.div key={rec.id} variants={item}>
      <RecommendationCard rec={rec} onApply={...} onDismiss={...} />
    </motion.div>
  ))}
</motion.div>
```

Update loading skeleton cards: change `border-slate-800 bg-slate-900` → `border-white/10 bg-white/5`
Update skeleton inner divs: change `bg-slate-800` → `bg-white/10`

Error block: change `bg-red-900/20 border border-red-800` → `bg-red-500/10 border border-red-500/30`

Empty state: change `text-slate-600` → `text-white/20`

- [ ] **Step 2: Commit**
```bash
git add app/optimize/page.tsx
git commit -m "feat: optimize page Playfair heading, glass skeletons, stagger cards"
```

---

## Task 8: Alerts page — Playfair h1 + glass table

**Files:**
- Modify: `app/alerts/page.tsx`

- [ ] **Step 1: Update h1, filter buttons, table container, and rows**

Update h1: `className="text-2xl font-bold text-white font-playfair"`

Filter buttons active state: change `bg-slate-600` → `bg-white/15`
Filter buttons inactive state: change `bg-slate-800 text-slate-400 hover:text-white` → `bg-white/5 text-white/40 border border-white/10 hover:text-white hover:bg-white/10`

Table container: change `rounded-xl border border-slate-800 bg-slate-900` → `rounded-xl border border-white/10 bg-white/5 backdrop-blur-md`

Table header row: change `border-b border-slate-800 text-left text-xs text-slate-500` → `border-b border-white/10 text-left text-xs text-white/30`

Data rows: change `border-b border-slate-800` → `border-b border-white/5 hover:bg-white/3 transition-colors`

Loading skeleton rows: change `border-b border-slate-800 animate-pulse` → `border-b border-white/5 animate-pulse`
Skeleton inner: change `bg-slate-800` → `bg-white/10`

Resolve button: change `bg-slate-700 hover:bg-slate-600` → `bg-white/10 hover:bg-white/20`

- [ ] **Step 2: Commit**
```bash
git add app/alerts/page.tsx
git commit -m "feat: alerts page glass table and Playfair heading"
```

---

## Task 9: Reports page — Playfair h1 + glass panels + glass inputs

**Files:**
- Modify: `app/reports/page.tsx`

- [ ] **Step 1: Update h1, inputs, metric cards, AI summary panel**

Update h1: `className="text-2xl font-bold text-white font-playfair"`

Date inputs: change `bg-slate-800 border border-slate-700` → `bg-white/5 border border-white/10 backdrop-blur-md`

Metric mini-cards: change `rounded-xl border border-slate-800 bg-slate-900 p-3` → `rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-3`

Generate Summary button: change `bg-slate-700 hover:bg-slate-600` → `bg-white/10 hover:bg-white/15 border border-white/10`

AI summary container: change `rounded-xl border border-slate-700 bg-slate-900 p-6` → `rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-6`

- [ ] **Step 2: Commit**
```bash
git add app/reports/page.tsx
git commit -m "feat: reports page glass panels, inputs, and Playfair heading"
```

---

## Task 10: Scheduler page — Playfair h1 + glass container

**Files:**
- Modify: `app/scheduler/page.tsx`

- [ ] **Step 1: Update h1 and result panel**

Update h1: `className="text-2xl font-bold text-white font-playfair"`

Result panel: change `bg-emerald-900/20 border border-emerald-800 rounded-xl p-4` → `bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-md rounded-xl p-4`

- [ ] **Step 2: Commit**
```bash
git add app/scheduler/page.tsx
git commit -m "feat: scheduler page Playfair heading and glass result panel"
```

---

## Task 11: Settings page — Playfair h1 + glass panels + glass inputs

**Files:**
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: Update h1, panel, inputs, and info blocks**

Update h1: `className="text-2xl font-bold text-white font-playfair"`

Main panel container: change `rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5` → `rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-6 space-y-5`

Section subheading: change `text-sm font-semibold text-slate-300 uppercase tracking-wide` → `text-sm font-semibold text-white/60 uppercase tracking-wide`

Inputs: change `bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm w-full` → `bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm w-full backdrop-blur-sm`

Info blocks: change `rounded-lg bg-slate-800 border border-slate-700 p-4 text-sm` → `rounded-lg bg-white/5 border border-white/10 p-4 text-sm`

- [ ] **Step 2: Commit**
```bash
git add app/settings/page.tsx
git commit -m "feat: settings page glass panels, inputs, and Playfair heading"
```

---

## Task 12: Build check + final commit

- [ ] **Step 1: Run build**
```bash
npm run build
```
Expected: clean build, no TypeScript or ESLint errors.

- [ ] **Step 2: If build fails, fix errors before proceeding**

Common issues to check:
- `font-playfair` not recognized → verify tailwind.config.ts `fontFamily.playfair` is inside `theme.extend`
- Framer Motion import missing from a page
- `motion.main` key prop on AppShell causing hydration issues → if so, remove the `key={pathname}` prop

- [ ] **Step 3: Push**
```bash
git push origin feat/gridmind
```
