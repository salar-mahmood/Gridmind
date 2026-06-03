# PillPress App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack Next.js 14 health tracker with daily pill reminders and blood pressure logging, backed by Supabase.

**Architecture:** App Router Next.js 14 with server components for data fetching and client components for interactive UI. Supabase handles auth, database, and row-level security so users only access their own data. All routes except `/auth` are protected by middleware.

**Tech Stack:** Next.js 14 (App Router), Supabase (auth + postgres), Tailwind CSS, recharts, TypeScript, Vercel.

---

## File Map

> **Note on `lib/utils.ts`:** The spec's folder diagram lists this file but defines no specific utilities for it. It is intentionally omitted — all shared logic lives in `lib/types.ts`, `lib/supabase.ts`, and `lib/supabase-server.ts`.

```
app/
  layout.tsx                   # Root layout: font, globals, Nav wrapper
  page.tsx                     # Dashboard: pill checklist + streak + last BP
  bp/
    page.tsx                   # BP log: form + table + chart
  settings/
    page.tsx                   # Settings: pill CRUD + notification prefs
  auth/
    page.tsx                   # Login / signup (email + password)
components/
  Nav.tsx                      # Top nav with links + sign out
  PillChecklist.tsx            # Client: checkbox list, calls pill_logs insert
  StreakBadge.tsx              # Displays current streak count
  BPForm.tsx                   # Client: form for systolic/diastolic/pulse/note
  BPChart.tsx                  # Client: recharts LineChart for systolic+diastolic
  PillManager.tsx              # Client: add/remove pills in settings
lib/
  supabase.ts                  # Browser supabase client (createBrowserClient)
  supabase-server.ts           # Server supabase client (createServerClient with cookies)
  types.ts                     # TypeScript types matching DB schema
middleware.ts                  # Redirects unauthenticated users to /auth
supabase/
  migrations/
    001_schema.sql             # All tables + RLS policies
.env.local.example             # Template for required env vars
```

---

## Task 1: Scaffold Next.js 14 + Tailwind + Dependencies

**Files:**
- Create: entire Next.js project in current directory

- [ ] **Step 1: Initialize Next.js 14 with TypeScript + Tailwind + App Router**

```bash
npx create-next-app@14 . --typescript --tailwind --app --src-dir=false --import-alias="@/*" --no-git
```

- [ ] **Step 2: Install Supabase and recharts**

```bash
npm install @supabase/supabase-js @supabase/ssr recharts
npm install -D @types/node
```

- [ ] **Step 3: Create env vars template**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Copy to `.env.local` and fill in real values from Supabase dashboard.

- [ ] **Step 4: Verify app runs**

```bash
npm run dev
```
Expected: App starts at http://localhost:3000 with default Next.js page.

- [ ] **Step 5: Commit**

```bash
git init && git add -A && git commit -m "feat: scaffold Next.js 14 + Tailwind + Supabase + recharts"
```

---

## Task 2: TypeScript Types + Supabase Clients

**Files:**
- Create: `lib/types.ts`
- Create: `lib/supabase.ts`
- Create: `lib/supabase-server.ts`

- [ ] **Step 1: Create `lib/types.ts`**

```typescript
export type Profile = {
  id: string
  created_at: string
}

export type Pill = {
  id: string
  user_id: string
  name: string
  dosage: string
  slot: 'morning' | 'evening' | 'custom'
  custom_time: string | null
  active: boolean
}

export type PillLog = {
  id: string
  user_id: string
  pill_id: string
  taken_at: string
  date: string
}

export type BPReading = {
  id: string
  user_id: string
  systolic: number
  diastolic: number
  pulse: number
  note: string | null
  recorded_at: string
}
```

- [ ] **Step 2: Create `lib/supabase.ts` (browser client)**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create `lib/supabase-server.ts` (server client)**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createServerSupabaseClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/ && git commit -m "feat: add Supabase clients and TypeScript types"
```

---

## Task 3: Database Schema + RLS Policies

**Files:**
- Create: `supabase/migrations/001_schema.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (mirrors auth.users)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  created_at timestamptz default now() not null
);
alter table profiles enable row level security;
create policy "Users can read own profile" on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Pills
create table pills (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  dosage text not null,
  slot text check (slot in ('morning', 'evening', 'custom')) not null default 'morning',
  custom_time time,
  active boolean default true not null
);
alter table pills enable row level security;
create policy "Users manage own pills" on pills for all using (auth.uid() = user_id);

-- Pill logs
create table pill_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  pill_id uuid references pills(id) on delete cascade not null,
  taken_at timestamptz default now() not null,
  date date default current_date not null
);
alter table pill_logs enable row level security;
create policy "Users manage own pill_logs" on pill_logs for all using (auth.uid() = user_id);

-- BP readings
create table bp_readings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  systolic int not null,
  diastolic int not null,
  pulse int not null,
  note text,
  recorded_at timestamptz default now() not null
);
alter table bp_readings enable row level security;
create policy "Users manage own bp_readings" on bp_readings for all using (auth.uid() = user_id);
```

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase dashboard → SQL Editor → paste and run `001_schema.sql`.
Verify tables appear in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/ && git commit -m "feat: add Supabase schema with RLS policies"
```

---

## Task 4: Middleware (Auth Protection)

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Redirect unauthenticated users to /auth
  if (!session && !request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  // Redirect authenticated users away from /auth
  if (session && request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2: Verify middleware works**

Start dev server. Visit http://localhost:3000 — should redirect to /auth.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts && git commit -m "feat: add auth middleware protecting all routes"
```

---

## Task 5: Auth Page (`/auth`)

**Files:**
- Create: `app/auth/page.tsx`

- [ ] **Step 1: Create `app/auth/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Sign up'}
          </button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-600">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-blue-600 hover:underline font-medium"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test manually**

Visit /auth. Try signing up with a new email. Verify redirect to / happens. Check Supabase dashboard → Auth → Users shows the new user.

- [ ] **Step 3: Commit**

```bash
git add app/auth/ && git commit -m "feat: add auth page with email/password login and signup"
```

---

## Task 6: Root Layout + Nav

**Files:**
- Create: `components/Nav.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create `components/Nav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Nav() {
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-blue-600 text-lg">PillPress</Link>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
          <Link href="/bp" className="text-sm text-gray-600 hover:text-gray-900">Blood Pressure</Link>
          <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">Settings</Link>
        </div>
        <button
          onClick={signOut}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Update `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PillPress',
  description: 'Daily pill reminders and blood pressure tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <Nav />
        <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx components/Nav.tsx && git commit -m "feat: add root layout with nav and sign out"
```

---

## Task 7: Settings Page — Pill Manager

> **Note:** The spec's `/settings` page also lists browser notification toggles and reminder times. These require Service Worker / Push API integration (PWA), which the spec classifies as V2. They are intentionally deferred and not implemented in V1.

**Files:**
- Create: `components/PillManager.tsx`
- Create: `app/settings/page.tsx`

- [ ] **Step 1: Create `components/PillManager.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Pill } from '@/lib/types'

export default function PillManager({ initialPills }: { initialPills: Pill[] }) {
  const [pills, setPills] = useState<Pill[]>(initialPills)
  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [slot, setSlot] = useState<'morning' | 'evening' | 'custom'>('morning')
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function addPill(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('pills')
      .insert({ name, dosage, slot, user_id: user.id })
      .select()
      .single()

    if (error) { setError(error.message); return }
    setPills(prev => [...prev, data])
    setName(''); setDosage('')
  }

  async function removePill(id: string) {
    await supabase.from('pills').update({ active: false }).eq('id', id)
    setPills(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addPill} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Add Pill</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="e.g. Metformin"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dosage</label>
            <input
              value={dosage} onChange={e => setDosage(e.target.value)} required
              placeholder="e.g. 500mg"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Time slot</label>
          <select
            value={slot} onChange={e => setSlot(e.target.value as typeof slot)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          Add pill
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Your Pills</h2>
        {pills.length === 0 && <p className="text-sm text-gray-500">No pills added yet.</p>}
        <ul className="space-y-2">
          {pills.map(pill => (
            <li key={pill.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <span className="text-sm font-medium text-gray-800">{pill.name}</span>
                <span className="text-xs text-gray-500 ml-2">{pill.dosage} · {pill.slot}</span>
              </div>
              <button
                onClick={() => removePill(pill.id)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/settings/page.tsx`**

```tsx
import PillManager from '@/components/PillManager'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient()
  const { data: pills } = await supabase
    .from('pills')
    .select('*')
    .eq('active', true)
    .order('slot')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <PillManager initialPills={pills ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Test manually**

Visit /settings. Add a pill. Verify it appears in the list. Click Remove — verify it disappears. Check Supabase Table Editor to confirm `active: false` on removed pills.

- [ ] **Step 4: Commit**

```bash
git add components/PillManager.tsx app/settings/ && git commit -m "feat: add settings page with pill CRUD"
```

---

## Task 8: Dashboard — Pill Checklist + Streak Badge

**Files:**
- Create: `components/PillChecklist.tsx`
- Create: `components/StreakBadge.tsx`
- Create: `app/page.tsx`

- [ ] **Step 1: Create `components/StreakBadge.tsx`**

```tsx
export default function StreakBadge({ streak }: { streak: number }) {
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
      <span className="text-3xl">🔥</span>
      <div>
        <p className="text-2xl font-bold text-orange-600">{streak}</p>
        <p className="text-xs text-orange-500 font-medium">day streak</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/PillChecklist.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Pill, PillLog } from '@/lib/types'

type PillWithLog = Pill & { taken: boolean; logId?: string }

// PillChecklist self-fetches today's logs using the local date.
// We cannot rely on the server to pass todayLogs because the server
// only knows UTC time — for users west of UTC, the UTC date may differ
// from the user's local date, causing pills to show as unchecked.
export default function PillChecklist({ pills }: { pills: Pill[] }) {
  const supabase = createClient()
  const [items, setItems] = useState<PillWithLog[]>(pills.map(p => ({ ...p, taken: false })))

  useEffect(() => {
    async function loadTodayLogs() {
      // en-CA locale produces YYYY-MM-DD in local time
      const today = new Date().toLocaleDateString('en-CA')
      const { data: logs } = await supabase
        .from('pill_logs')
        .select('*')
        .eq('date', today)
      if (!logs) return
      setItems(pills.map(pill => ({
        ...pill,
        taken: logs.some((log: PillLog) => log.pill_id === pill.id),
        logId: logs.find((log: PillLog) => log.pill_id === pill.id)?.id,
      })))
    }
    loadTodayLogs()
  }, [pills])

  async function toggle(pill: PillWithLog) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (pill.taken && pill.logId) {
      await supabase.from('pill_logs').delete().eq('id', pill.logId)
      setItems(prev => prev.map(p =>
        p.id === pill.id ? { ...p, taken: false, logId: undefined } : p
      ))
    } else {
      // Use en-CA locale to get YYYY-MM-DD in local time (not UTC)
      const today = new Date().toLocaleDateString('en-CA')
      const { data } = await supabase
        .from('pill_logs')
        .insert({ pill_id: pill.id, user_id: user.id, date: today })
        .select()
        .single()
      if (data) {
        setItems(prev => prev.map(p =>
          p.id === pill.id ? { ...p, taken: true, logId: data.id } : p
        ))
      }
    }
  }

  const slots = ['morning', 'evening', 'custom'] as const

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Today's Pills</h2>
      {items.length === 0 && (
        <p className="text-sm text-gray-500">
          No pills scheduled. <a href="/settings" className="text-blue-600 hover:underline">Add some in Settings.</a>
        </p>
      )}
      {slots.map(slot => {
        const slotPills = items.filter(p => p.slot === slot)
        if (!slotPills.length) return null
        return (
          <div key={slot} className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 capitalize">{slot}</p>
            <ul className="space-y-2">
              {slotPills.map(pill => (
                <li key={pill.id}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pill.taken}
                      onChange={() => toggle(pill)}
                      className="w-5 h-5 rounded accent-blue-600"
                    />
                    <span className={`text-sm ${pill.taken ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {pill.name} <span className="text-gray-400">{pill.dosage}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create `app/page.tsx` (Dashboard)**

```tsx
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PillChecklist from '@/components/PillChecklist'
import StreakBadge from '@/components/StreakBadge'
import Link from 'next/link'

async function calcStreak(userId: string, supabase: ReturnType<typeof createServerSupabaseClient>) {
  const { data } = await supabase
    .from('pill_logs')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (!data || data.length === 0) return 0

  const dates = [...new Set(data.map(r => r.date))].sort().reverse()
  let streak = 0
  // Use en-CA locale for YYYY-MM-DD in local time, not UTC
  const today = new Date().toLocaleDateString('en-CA')
  let cursor = today

  for (const date of dates) {
    if (date === cursor) {
      streak++
      // Advance cursor back one local day using date-only arithmetic (no timezone shift)
      const [y, m, d] = cursor.split('-').map(Number)
      const prev = new Date(y, m - 1, d - 1)
      cursor = prev.toLocaleDateString('en-CA')
    } else {
      break
    }
  }
  return streak
}

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // NOTE: We do NOT fetch todayLogs here. PillChecklist is a client component
  // that self-fetches today's logs using the browser's local date (toLocaleDateString('en-CA')).
  // Fetching todayLogs server-side would use UTC time, causing date mismatches for
  // users in timezones west of UTC (e.g., pills logged late evening showing as unchecked).
  const [{ data: pills }, { data: lastBP }, streak] = await Promise.all([
    supabase.from('pills').select('*').eq('user_id', user.id).eq('active', true).order('slot'),
    supabase.from('bp_readings').select('*').eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(1),
    calcStreak(user.id, supabase),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/bp"
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          Log BP
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StreakBadge streak={streak} />
        {lastBP && lastBP[0] ? (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Last BP</p>
            <p className="text-xl font-bold text-gray-800">
              {lastBP[0].systolic}/{lastBP[0].diastolic}
            </p>
            <p className="text-xs text-gray-500">{lastBP[0].pulse} bpm</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(lastBP[0].recorded_at).toLocaleDateString()}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center text-sm text-gray-400">
            No BP readings yet
          </div>
        )}
      </div>

      <PillChecklist pills={pills ?? []} />
    </div>
  )
}
```

- [ ] **Step 4: Test manually**

Sign in. Dashboard should show streak (0 initially), no BP, and pill checklist. Check off a pill — verify it gets checked. Verify streak increments to 1 after checking a pill for today.

- [ ] **Step 5: Commit**

```bash
git add components/PillChecklist.tsx components/StreakBadge.tsx app/page.tsx && git commit -m "feat: add dashboard with pill checklist and streak counter"
```

---

## Task 9: BP Page — Form + Table + Chart

> **Note:** The spec lists CSV export as V2 ("Nice to Have"). It is promoted to V1 here because it requires no additional dependencies — just a Blob URL and anchor click.

**Files:**
- Create: `components/BPForm.tsx`
- Create: `components/BPChart.tsx`
- Create: `app/bp/page.tsx`

- [ ] **Step 1: Create `components/BPForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { BPReading } from '@/lib/types'

export default function BPForm({ onAdd }: { onAdd: (reading: BPReading) => void }) {
  const [systolic, setSystolic] = useState('')
  const [diastolic, setDiastolic] = useState('')
  const [pulse, setPulse] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('bp_readings')
      .insert({
        user_id: user.id,
        systolic: parseInt(systolic),
        diastolic: parseInt(diastolic),
        pulse: parseInt(pulse),
        note: note || null,
      })
      .select()
      .single()

    setLoading(false)
    if (error) { setError(error.message); return }
    onAdd(data)
    setSystolic(''); setDiastolic(''); setPulse(''); setNote('')
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
      <h2 className="font-semibold text-gray-900">Log Blood Pressure</h2>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Systolic', value: systolic, set: setSystolic, placeholder: '120' },
          { label: 'Diastolic', value: diastolic, set: setDiastolic, placeholder: '80' },
          { label: 'Pulse', value: pulse, set: setPulse, placeholder: '72' },
        ].map(({ label, value, set, placeholder }) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input
              type="number" min="1" max="300"
              value={value} onChange={e => set(e.target.value)}
              placeholder={placeholder} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
        <input
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="e.g. after exercise"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save reading'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create `components/BPChart.tsx`**

```tsx
'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { BPReading } from '@/lib/types'

export default function BPChart({ readings }: { readings: BPReading[] }) {
  const data = [...readings]
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map(r => ({
      date: new Date(r.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      systolic: r.systolic,
      diastolic: r.diastolic,
    }))

  if (data.length < 2) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 text-sm text-gray-400">
        Add at least 2 readings to see the chart.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Trend</h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="systolic" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="diastolic" stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/bp/page.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import BPForm from '@/components/BPForm'
import BPChart from '@/components/BPChart'
import type { BPReading } from '@/lib/types'

const PAGE_SIZE = 10

export default function BPPage() {
  // Paginated rows for table
  const [readings, setReadings] = useState<BPReading[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  // Full history for chart (not paginated)
  const [allReadings, setAllReadings] = useState<BPReading[]>([])
  const supabase = createClient()

  useEffect(() => {
    fetchReadings()
  }, [page])

  useEffect(() => {
    fetchAllReadings()
  }, [])

  async function fetchReadings() {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, count } = await supabase
      .from('bp_readings')
      .select('*', { count: 'exact' })
      .order('recorded_at', { ascending: false })
      .range(from, to)
    if (data) setReadings(data)
    if (count !== null) setTotal(count)
  }

  async function fetchAllReadings() {
    const { data } = await supabase
      .from('bp_readings')
      .select('*')
      .order('recorded_at', { ascending: true })
    if (data) setAllReadings(data)
  }

  function exportCSV() {
    const header = 'Date,Systolic,Diastolic,Pulse,Note\n'
    const rows = allReadings
      .map(r => `${r.recorded_at},${r.systolic},${r.diastolic},${r.pulse},"${r.note ?? ''}"`)
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'bp-readings.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleAdd(r: BPReading) {
    setReadings(prev => [r, ...prev])
    setTotal(t => t + 1)
    setAllReadings(prev => [...prev, r])
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Blood Pressure</h1>
        {allReadings.length > 0 && (
          <button
            onClick={exportCSV}
            className="text-sm text-blue-600 hover:underline"
          >
            Export CSV
          </button>
        )}
      </div>

      <BPForm onAdd={handleAdd} />

      <BPChart readings={allReadings} />

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Date', 'Systolic', 'Diastolic', 'Pulse', 'Note'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {readings.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-gray-600">{new Date(r.recorded_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-medium">{r.systolic}</td>
                <td className="px-4 py-3 font-medium">{r.diastolic}</td>
                <td className="px-4 py-3">{r.pulse}</td>
                <td className="px-4 py-3 text-gray-500">{r.note ?? '—'}</td>
              </tr>
            ))}
            {readings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No readings yet.</td>
              </tr>
            )}
          </tbody>
        </table>
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-sm text-blue-600 hover:underline disabled:text-gray-300"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= total}
              className="text-sm text-blue-600 hover:underline disabled:text-gray-300"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test manually**

Visit /bp. Log a BP reading. Verify it appears in the table. Add 2+ readings — chart should appear. Click Export CSV — verify file downloads.

- [ ] **Step 5: Commit**

```bash
git add components/BPForm.tsx components/BPChart.tsx app/bp/ && git commit -m "feat: add BP page with form, table, chart, and CSV export"
```

---

## Task 10: Mobile Responsiveness Polish + Final QA

**Files:**
- Modify: `components/Nav.tsx` (mobile menu or simplified)
- Modify: `app/bp/page.tsx` (responsive table)

- [ ] **Step 1: Make BP table horizontally scrollable on mobile**

In `app/bp/page.tsx`, find the `<div className="bg-white rounded-xl shadow-sm overflow-hidden">` that wraps the table and add an inner scroll wrapper:

```tsx
<div className="bg-white rounded-xl shadow-sm overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      {/* ... thead and tbody unchanged ... */}
    </table>
  </div>
  {/* pagination stays outside the scroll wrapper */}
  {total > PAGE_SIZE && (
    // ... pagination unchanged ...
  )}
</div>
```

- [ ] **Step 2: Simplify Nav for mobile**

In `components/Nav.tsx`, replace `<div className="flex items-center gap-6">` (the link group) with:
```tsx
<div className="flex items-center gap-4 flex-wrap text-sm">
```

This allows nav links to wrap onto a second line on small screens rather than overflowing.

- [ ] **Step 3: End-to-end QA checklist**

- [ ] Sign up with a new email
- [ ] Add 3 pills (morning x2, evening x1)
- [ ] Check off all pills on Dashboard — streak shows 1
- [ ] Log a BP reading
- [ ] Dashboard shows last BP reading
- [ ] Visit /bp — reading appears in table and chart (add 2+ total)
- [ ] Export CSV — opens file with correct data
- [ ] Sign out — redirects to /auth
- [ ] Sign in — back to dashboard

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "feat: mobile polish and complete PillPress V1"
```

---

## Deployment (Vercel)

- [ ] Push repo to GitHub
- [ ] Connect GitHub repo to Vercel
- [ ] Add env vars in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Deploy — verify production URL works end-to-end
