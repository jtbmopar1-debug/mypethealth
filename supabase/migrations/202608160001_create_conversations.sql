create table if not exists public.shopify_conversations (
  id uuid not null,
  shopify_customer_id text not null,
  title text not null check (char_length(title) between 1 and 120),
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
  pet_profile jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, shopify_customer_id)
);

create index if not exists shopify_conversations_customer_updated_idx
  on public.shopify_conversations (shopify_customer_id, updated_at desc);

alter table public.shopify_conversations enable row level security;

revoke all on public.shopify_conversations from anon, authenticated;
grant select, insert, update, delete on public.shopify_conversations to service_role;

comment on table public.shopify_conversations is
  'Buddy chats accessed only by the server after a verified Shopify Customer Account login.';
