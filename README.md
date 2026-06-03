# PillPress

A personal health tracker for daily pill reminders and blood pressure logging.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database + Auth**: Supabase
- **Styling**: Tailwind CSS
- **Charts**: recharts
- **Deploy**: Vercel

## Local Setup

1. Copy env template and fill in your Supabase credentials:
   ```bash
   cp .env.local.example .env.local
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the Supabase migration in your project's SQL Editor:
   `supabase/migrations/001_schema.sql`

4. Start the dev server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).
