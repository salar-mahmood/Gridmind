# PillPress — Health Reminder App Spec

## Overview
A personal health tracker web app for daily pill reminders and blood pressure logging.
Built with Next.js 14 (App Router), Supabase, Tailwind CSS. Deployed on Vercel.

---

## Pages

### 1. `/` — Dashboard
- Today's pill checklist (morning / evening slots)
- Last blood pressure reading (systolic / diastolic / pulse + timestamp)
- Current streak (days in a row all pills taken)
- Quick "Log BP" button

### 2. `/bp` — Blood Pressure Log
- Form: systolic, diastolic, pulse, optional note
- Table of past readings (paginated, newest first)
- Line chart of systolic + diastolic over time (recharts)
- Export to CSV button

### 3. `/settings` — Settings
- Define pill schedule: name, dosage, time (morning / evening / custom)
- Add / remove pills
- Enable/disable browser notifications
- Set reminder times

### 4. `/auth` — Login / Signup
- Email + password via Supabase Auth
- Redirect to dashboard on success

---

## Data Models (Supabase)

### `profiles`
| column | type | notes |
|---|---|---|
| id | uuid | FK → auth.users |
| created_at | timestamptz | |

### `pills`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| name | text | e.g. "Metformin" |
| dosage | text | e.g. "500mg" |
| slot | text | morning / evening / custom |
| custom_time | time | nullable |
| active | boolean | default true |

### `pill_logs`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| pill_id | uuid | FK → pills |
| taken_at | timestamptz | |
| date | date | for daily grouping |

### `bp_readings`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| systolic | int | mmHg |
| diastolic | int | mmHg |
| pulse | int | bpm |
| note | text | nullable |
| recorded_at | timestamptz | |

---

## Features

### Must Have (V1)
- [ ] Supabase Auth (email/password)
- [ ] Add/remove pills with name, dosage, slot
- [ ] Daily pill checklist with checkoff
- [ ] Streak counter
- [ ] Log blood pressure (systolic/diastolic/pulse)
- [ ] BP history table
- [ ] BP trend line chart (recharts)
- [ ] Mobile-responsive layout

### Nice to Have (V2)
- [ ] PWA with push notifications for reminders
- [ ] Export BP readings to CSV
- [ ] Weekly summary email via Supabase Edge Functions
- [ ] Dark/light mode toggle

---

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database + Auth**: Supabase
- **Styling**: Tailwind CSS
- **Charts**: recharts
- **Deploy**: Vercel

---

## Folder Structure
```
app/
  page.tsx              # Dashboard
  bp/page.tsx           # BP log
  settings/page.tsx     # Settings
  auth/page.tsx         # Login/signup
  layout.tsx
components/
  PillChecklist.tsx
  BPForm.tsx
  BPChart.tsx
  StreakBadge.tsx
lib/
  supabase.ts
  utils.ts
```

---

## Claude Code Instructions
1. Scaffold Next.js 14 app with Tailwind
2. Set up Supabase client with env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
3. Create all Supabase tables with RLS policies (users can only access their own rows)
4. Build pages in order: auth → settings → dashboard → bp
5. Add recharts BP trend chart last
