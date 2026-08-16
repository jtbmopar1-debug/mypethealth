create table if not exists public.conversations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  messages jsonb not null default '[]'::jsonb,
  pet_profile jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

alter table public.conversations enable row level security;

revoke all on public.conversations from anon;
grant select, insert, update, delete on public.conversations to authenticated;

create policy "Customers can view their own conversations"
  on public.conversations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Customers can create their own conversations"
  on public.conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Customers can update their own conversations"
  on public.conversations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Customers can delete their own conversations"
  on public.conversations for delete to authenticated
  using ((select auth.uid()) = user_id);
