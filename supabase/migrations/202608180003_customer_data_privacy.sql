-- Provides one atomic, server-only operation for a customer to delete the data
-- Buddy owns. Shopify account, order and payment data are not modified.

create or replace function public.delete_buddy_customer_data(target_customer_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.shopify_conversations
  where shopify_customer_id = target_customer_id;

  delete from public.shopify_customer_pets
  where shopify_customer_id = target_customer_id;
end;
$$;

revoke all on function public.delete_buddy_customer_data(text) from public, anon, authenticated;
grant execute on function public.delete_buddy_customer_data(text) to service_role;
