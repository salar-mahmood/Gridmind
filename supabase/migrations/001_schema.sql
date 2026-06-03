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
