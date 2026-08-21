create table if not exists public.restock_enquiries (
  id uuid primary key,
  shopify_customer_id text not null,
  customer_email text not null,
  product_id text not null,
  product_title text not null,
  product_url text not null,
  customer_question text not null,
  status text not null check (status in ('sending', 'sent', 'failed')),
  idempotency_key text not null unique,
  resend_email_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists restock_enquiries_customer_created_idx
  on public.restock_enquiries (shopify_customer_id, created_at desc);

alter table public.restock_enquiries enable row level security;
revoke all on public.restock_enquiries from anon, authenticated;
grant select, insert, update on public.restock_enquiries to service_role;

comment on table public.restock_enquiries is
  'Server-only audit log for customer-approved Buddy stock enquiry emails.';

create or replace function public.delete_buddy_customer_data(target_customer_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.restock_enquiries where shopify_customer_id = target_customer_id;
  delete from public.shopify_conversations where shopify_customer_id = target_customer_id;
  delete from public.shopify_customer_pets where shopify_customer_id = target_customer_id;
end;
$$;

revoke all on function public.delete_buddy_customer_data(text) from public, anon, authenticated;
grant execute on function public.delete_buddy_customer_data(text) to service_role;
