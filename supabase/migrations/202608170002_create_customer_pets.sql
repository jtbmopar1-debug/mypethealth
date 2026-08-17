create table if not exists public.shopify_customer_pets (
  id uuid primary key default gen_random_uuid(),
  shopify_customer_id text not null,
  name text not null check (char_length(name) between 1 and 80),
  species text check (species in ('dog', 'cat') or species is null),
  breed text check (char_length(breed) between 1 and 120 or breed is null),
  age_value numeric check (age_value >= 0 or age_value is null),
  age_unit text check (age_unit in ('weeks', 'months', 'years') or age_unit is null),
  age_recorded_at timestamptz,
  weight_kg numeric check (weight_kg > 0 or weight_kg is null),
  current_food_title text check (char_length(current_food_title) between 1 and 500 or current_food_title is null),
  known_sensitivities text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'deceased', 'archived')),
  deceased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_mentioned_at timestamptz not null default now()
);

create unique index if not exists shopify_customer_pets_customer_name_idx
  on public.shopify_customer_pets (shopify_customer_id, lower(name));

create index if not exists shopify_customer_pets_customer_status_idx
  on public.shopify_customer_pets (shopify_customer_id, status, last_mentioned_at desc);

alter table public.shopify_customer_pets enable row level security;

revoke all on public.shopify_customer_pets from anon, authenticated;
grant select, insert, update, delete on public.shopify_customer_pets to service_role;

comment on table public.shopify_customer_pets is
  'Customer-level pet memory used by Buddy. Accessed only by the server after verified Shopify login.';
