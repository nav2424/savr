-- Create image_library table for curated and cached recipe images
create table if not exists public.image_library (
  path text primary key,
  deterministic_key text unique,
  class text not null,
  primary_item text not null,
  method text not null,
  source text not null,
  provider_id text,
  width integer,
  height integer,
  credit_user text,
  credit_username text,
  credit_link text,
  alt_text text,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Helpful indexes for lookup paths
create index if not exists image_library_class_method_idx
  on public.image_library (class, primary_item, method);

create index if not exists image_library_deterministic_idx
  on public.image_library (deterministic_key);

