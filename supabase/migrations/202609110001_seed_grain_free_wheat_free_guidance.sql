-- Store-owner guidance explaining when wheat-free and grain-free foods are
-- useful. This distinction should be retrieved before Buddy treats
-- "grain-free" as automatically better for every dog.

insert into public.knowledge_entries
  (id, question, answer, category, summary, follow_up_questions, safety_notes, tags, relevant_product_tags, recommended_product_urls, source_candidate_id, enabled, publication_status, created_by)
values
  (
    '40000000-0000-4000-8000-000000000004',
    'Is grain-free food better than wheat-free food for dogs?',
    'All Good Petfood''s guidance is that most dogs with a food-related grain concern are reacting to wheat rather than to every grain. Grain-free food is often promoted as the better option, but it is not automatically the right choice for every dog. Most dogs can do well on a wheat-free food. Grain-free is the cleanest step above wheat-free and may be the preferred option when a dog has yeast issues, but otherwise wheat-free is generally the more appropriate starting point. All Good Petfood advises that around 99% of dogs with this type of allergy concern react to wheat rather than grain generally. Choose according to the individual dog''s needs rather than treating grain-free as universally better.',
    'diet-and-allergies',
    'Most dogs do not need every grain removed: wheat-free is generally the better starting point, while grain-free may be preferred for dogs with yeast issues.',
    array['Does your dog have a known wheat sensitivity or a broader grain sensitivity?', 'Are you trying to manage a diagnosed or recurring yeast issue?', 'What food and main protein is your dog eating now?'],
    array['Do not diagnose a wheat allergy or yeast condition from symptoms alone.', 'Do not describe grain-free food as automatically healthier or suitable for every dog.', 'Keep the 99% figure clearly attributed to All Good Petfood''s store-owner guidance.'],
    array['grain free', 'grain-free', 'wheat free', 'wheat-free', 'wheat allergy', 'grain allergy', 'dog allergies', 'food sensitivities', 'yeast', 'yeast issues', 'marketing trend', 'hypoallergenic food'],
    array['grain-free', 'wheat-free', 'hypoallergenic'],
    array[]::text[],
    'allgoodpetfood-owner:grain-free-vs-wheat-free',
    true,
    'published',
    'verified-store-owner'
  )
on conflict (id) do nothing;
