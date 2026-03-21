-- Family plan (owner) + seats (invites / members)
-- Run via Supabase CLI: supabase db push / migration apply

create table if not exists public.family_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  max_seats int not null default 5 check (max_seats >= 1 and max_seats <= 20),
  created_at timestamptz not null default now(),
  constraint family_plans_owner_unique unique (owner_id)
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_plan_id uuid not null references public.family_plans (id) on delete cascade,
  member_id uuid references auth.users (id) on delete set null,
  invite_code text not null unique default gen_random_uuid()::text,
  invite_email text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'removed')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists family_members_plan_idx on public.family_members (family_plan_id);
create index if not exists family_members_member_idx on public.family_members (member_id) where member_id is not null;
create index if not exists family_members_invite_code_idx on public.family_members (invite_code);

alter table public.family_plans enable row level security;
alter table public.family_members enable row level security;

-- Owner: full CRUD on own plan
create policy family_plans_owner_select on public.family_plans
  for select using (auth.uid() = owner_id);

create policy family_plans_owner_insert on public.family_plans
  for insert with check (auth.uid() = owner_id);

create policy family_plans_owner_update on public.family_plans
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy family_plans_owner_delete on public.family_plans
  for delete using (auth.uid() = owner_id);

-- Members: owner manages all rows on their plan
create policy family_members_owner_select on public.family_members
  for select using (
    exists (
      select 1 from public.family_plans fp
      where fp.id = family_plan_id and fp.owner_id = auth.uid()
    )
  );

create policy family_members_owner_insert on public.family_members
  for insert with check (
    exists (
      select 1 from public.family_plans fp
      where fp.id = family_plan_id and fp.owner_id = auth.uid()
    )
  );

create policy family_members_owner_update on public.family_members
  for update using (
    exists (
      select 1 from public.family_plans fp
      where fp.id = family_plan_id and fp.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.family_plans fp
      where fp.id = family_plan_id and fp.owner_id = auth.uid()
    )
  );

create policy family_members_owner_delete on public.family_members
  for delete using (
    exists (
      select 1 from public.family_plans fp
      where fp.id = family_plan_id and fp.owner_id = auth.uid()
    )
  );

-- Accepted member: read own membership row
create policy family_members_member_select_self on public.family_members
  for select using (member_id = auth.uid());

comment on table public.family_plans is 'Subscription-sharing group; owner must have active RevenueCat pro (enforced in app + edge).';
comment on table public.family_members is 'Invites and seats; accept flow uses edge function for integrity.';
