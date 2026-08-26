alter table public.shopify_customer_pets
  add column if not exists notes text;

alter table public.shopify_customer_pets
  drop constraint if exists shopify_customer_pets_notes_length_check;

alter table public.shopify_customer_pets
  add constraint shopify_customer_pets_notes_length_check
  check (notes is null or char_length(notes) <= 4000);

comment on column public.shopify_customer_pets.notes is
  'Optional customer-authored notes Buddy may use as pet-profile context.';
