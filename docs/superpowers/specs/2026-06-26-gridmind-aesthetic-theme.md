# GridMind Aesthetic Theme — Design Spec
**Date:** 2026-06-26  
**Status:** Approved

## Goal

Make all interior app pages (Dashboard, Optimize, Scheduler, Reports, Alerts, Settings) visually cohesive with the WovenLight hero landing page — sharing its dark luxury aesthetic: pure black background, Playfair Display headings, frosted glass surfaces, multi-color accent glows, and Framer Motion page entrance animations.

## Approach

Hybrid: theme layer updates the global shell and shared components; targeted per-component polish handles visually prominent components.

---

## 1. Global Shell

### Background
- Change body from `bg-slate-950` to `bg-black` in `app/globals.css` and `app/layout.tsx`
- Add ambient radial gradient bleed on main via a wrapper:
  ```css
  background: radial-gradient(ellipse at top left, rgba(56,189,248,0.04) 0%, transparent 60%),
              radial-gradient(ellipse at bottom right, rgba(167,139,250,0.04) 0%, transparent 60%), #000;
  ```

### Nav
- Background: `bg-black/60 backdrop-blur-xl border-b border-white/10`
- Logo: Playfair Display font, white
- Active link: `bg-white/10 text-white`
- Inactive link: `text-white/50 hover:text-white hover:bg-white/5`

### AppShell
- Wrap main content in Framer Motion fade: `initial={{ opacity: 0 }} animate={{ opacity: 1 }}`
- Add ambient background gradient to the main element

---

## 2. Typography

- Load Playfair Display in `app/layout.tsx` via next/font or link tag
- Apply Playfair Display to all page-level h1 and section h2 headings
- Inter stays for body text, labels, and data values

---

## 3. MetricCard

Replace solid gradient backgrounds with glass surfaces + colored glow shadows:

| Variant | Border | Shadow |
|---------|--------|--------|
| blue    | `border-blue-500/30` | `shadow-blue-500/20` |
| green   | `border-emerald-500/30` | `shadow-emerald-500/20` |
| amber   | `border-amber-500/30` | `shadow-amber-500/20` |
| red     | `border-red-500/30` | `shadow-red-500/20` |

Card base: `bg-white/5 backdrop-blur-md border rounded-xl shadow-lg`
Stagger animation with 0.05s delay per card index.

---

## 4. InsightFeed

- Card base: `bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg`
- Left accent border by priority: critical=red, high=amber, medium=blue, low=emerald
- Entrance: `initial={{ opacity: 0, x: -8 }}`

---

## 5. RackHeatmap

- Container: `bg-white/5 backdrop-blur-md border border-white/10 rounded-xl`
- Cells keep temp color coding but gain matching glow shadow

---

## 6. PowerChart

- Container: `bg-white/5 backdrop-blur-md border border-white/10 rounded-xl`
- Tooltip: `bg-black/80 border border-white/10 backdrop-blur-md`

---

## 7. Page Entrance Animations

Stagger container + item variants on all 6 pages:
- container: staggerChildren 0.07s
- item: opacity 0->1, y 16->0, duration 0.4s, ease [0.2, 0.65, 0.3, 0.9]

---

## 8. Other Pages

- All panels: `bg-white/5 backdrop-blur-md border border-white/10`
- RecommendationCards: `border-l-4` priority color + glass bg
- Alert rows: glass bg, severity badge glows
- Settings inputs: `bg-white/5 border border-white/10`

---

## Files to Change

| File | Change |
|------|--------|
| `app/globals.css` | bg-black body, ambient gradient utility |
| `app/layout.tsx` | Load Playfair Display font |
| `components/shared/Nav.tsx` | Glass nav, Playfair logo |
| `components/shared/AppShell.tsx` | Framer Motion fade, ambient bg |
| `components/dashboard/MetricCard.tsx` | Glass + glow variants, stagger anim |
| `components/dashboard/InsightFeed.tsx` | Glass cards, left accent border |
| `components/dashboard/RackHeatmap.tsx` | Glass container, cell glow shadows |
| `components/dashboard/PowerChart.tsx` | Glass container, glass tooltip |
| `app/dashboard/page.tsx` | Playfair h1, stagger wrapper |
| `app/optimize/page.tsx` | Playfair h1, stagger, glass cards |
| `app/alerts/page.tsx` | Playfair h1, glass rows, glows |
| `app/reports/page.tsx` | Playfair h1, glass panels |
| `app/scheduler/page.tsx` | Playfair h1, glass container |
| `app/settings/page.tsx` | Playfair h1, glass inputs |
| `components/optimize/RecommendationCard.tsx` | Glass + priority border glow |

## Out of Scope

- Three.js particles on interior pages
- Changing chart library or data logic
- Mobile layout changes beyond Tailwind responsive
