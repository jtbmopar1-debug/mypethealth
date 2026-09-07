-- Store-owner guidance for the product background colours used in the online
-- catalogue. Pink identifies hypoallergenic products; green identifies
-- non-hypoallergenic products.

insert into public.knowledge_entries
  (id, question, answer, category, summary, follow_up_questions, safety_notes, tags, relevant_product_tags, recommended_product_urls, source_candidate_id, enabled, publication_status, created_by)
values
  (
    '40000000-0000-4000-8000-000000000003',
    'What do the pink and green product backgrounds mean in the online store?',
    'Products with a pink background in the All Good Petfood online store are hypoallergenic and are safe for dogs and cats, including those with allergies or sensitivities. Products with a green background are non-hypoallergenic and are intended for dogs and cats without allergies or sensitivities. Use the background colour as a quick guide when browsing the online store.',
    'product-labels',
    'The online store uses pink for hypoallergenic products and green for non-hypoallergenic products.',
    array['Does your dog or cat have any known allergies or sensitivities?', 'Would you like help finding a pink-background hypoallergenic product?'],
    array['Do not recommend a green-background product for a pet with known allergies or sensitivities.'],
    array['pink background', 'green background', 'pink products', 'green products', 'colour coding', 'color coding', 'hypoallergenic', 'non-hypoallergenic', 'allergies', 'sensitivities', 'online store'],
    array['hypoallergenic'],
    array[]::text[],
    'allgoodpetfood-owner:product-colour-coding',
    true,
    'published',
    'verified-store-owner'
  )
on conflict (id) do nothing;
