create unique index if not exists shopify_conversations_id_customer_idx
  on public.shopify_conversations (id, shopify_customer_id);

create table if not exists public.buddy_contact_enquiries (
  id uuid primary key,
  shopify_customer_id text not null,
  customer_email text not null,
  conversation_id uuid not null,
  conversation_title text not null,
  customer_message text not null,
  message_count integer not null check (message_count > 0),
  status text not null check (status in ('sending', 'sent', 'failed')),
  idempotency_key text not null unique,
  resend_email_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, shopify_customer_id)
    references public.shopify_conversations (id, shopify_customer_id)
    on delete cascade
);

create index if not exists buddy_contact_enquiries_customer_created_idx
  on public.buddy_contact_enquiries (shopify_customer_id, created_at desc);

alter table public.buddy_contact_enquiries enable row level security;
revoke all on public.buddy_contact_enquiries from anon, authenticated;
grant select, insert, update on public.buddy_contact_enquiries to service_role;

comment on table public.buddy_contact_enquiries is
  'Server-only audit log for customer-approved emails containing a Buddy chat transcript.';

create or replace function public.delete_buddy_customer_data(target_customer_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.buddy_contact_enquiries where shopify_customer_id = target_customer_id;
  delete from public.restock_enquiries where shopify_customer_id = target_customer_id;
  delete from public.shopify_conversations where shopify_customer_id = target_customer_id;
  delete from public.shopify_customer_pets where shopify_customer_id = target_customer_id;
end;
$$;

revoke all on function public.delete_buddy_customer_data(text) from public, anon, authenticated;
grant execute on function public.delete_buddy_customer_data(text) to service_role;
