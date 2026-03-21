-- One-time: everyone who already has a public.users row at migration time gets lifetime complimentary premium.
-- New signups after this migration keep grandfathered_lifetime_premium = false (column default).

alter table public.users
  add column if not exists grandfathered_lifetime_premium boolean not null default false;

comment on column public.users.grandfathered_lifetime_premium is
  'When true, app grants premium without RevenueCat (legacy / early users). New users default false.';

-- All accounts that exist today
update public.users
set grandfathered_lifetime_premium = true
where grandfathered_lifetime_premium = false;
