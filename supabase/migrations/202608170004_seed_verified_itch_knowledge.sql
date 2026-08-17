-- Reviewed and generalised from the verified All Good Petfood "Itchy Dog Replies"
-- document. Medical wording is deliberately conservative: Buddy must not diagnose
-- allergy type from symptom location or treat a retail diet as a diagnostic test.

insert into public.knowledge_entries
  (id, question, answer, category, summary, follow_up_questions, safety_notes, tags, relevant_product_tags, recommended_product_urls, source_candidate_id, enabled, created_by)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'My dog is itchy. What information helps narrow down the cause?',
    'Itching is a symptom rather than a diagnosis and can have several causes, including fleas or other parasites, environmental triggers, infection and adverse food reactions. Start by asking the dog''s breed or mix, age, when the itching began, which body areas are affected, whether it changes with the seasons, everything currently eaten including treats and flavoured supplements, parasite prevention, and what has already been tried. Odour, discharge, broken skin, marked redness, hair loss, pain or persistent symptoms increase the need for veterinary assessment. Do not identify the cause from itch location alone.',
    'itchy-dogs',
    'Gather diet, timing, distribution, seasonality and warning signs before discussing products or food changes.',
    array['What breed or mix and age is your dog?', 'How long have they been itchy, and which areas are affected?', 'Is it seasonal or present all year?', 'What food, treats and flavoured supplements do they receive?', 'Are parasite prevention and veterinary skin checks up to date?'],
    array['Itching can have multiple simultaneous causes.', 'Persistent, severe or worsening itching, infection signs, pain or broken skin needs veterinary advice.', 'Do not diagnose food or environmental allergy from symptom location.'],
    array['itchy dog', 'itching', 'scratch', 'licking', 'skin', 'allergy', 'environmental allergy', 'food reaction', 'assessment'],
    array[]::text[],
    array[]::text[],
    'google-doc-itchy-dog-replies:assessment', true, 'verified-google-doc'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Could my dog''s itching be caused by food, and should I try an elimination diet?',
    'Food can contribute to itching, but symptoms alone cannot reliably distinguish a food reaction from environmental allergy, parasites or secondary infection. A proper diagnostic elimination trial uses a veterinarian-selected complete diet containing suitable novel or hydrolysed protein, fed exclusively for the recommended period, followed by a controlled food challenge. Treats, chews, table food, flavoured medication and supplements can invalidate the trial. All Good Petfood has foods intended for sensitive dogs and alternative-protein feeding, but an over-the-counter food change should not be described as proof of an allergy or as equivalent to a veterinary diagnostic diet. Ask what proteins and foods the dog has previously eaten before suggesting a store option.',
    'itchy-dogs',
    'Explain the difference between a sensitive-dog food option and a veterinary diagnostic elimination trial.',
    array['What food, proteins, treats and supplements has your dog previously eaten?', 'Has your veterinarian recommended a formal elimination trial?', 'Is the itching seasonal or present all year?', 'Are there ear problems, digestive signs or recurring skin infections?'],
    array['A strict elimination trial followed by controlled rechallenge is the reliable way to diagnose food allergy.', 'Never promise that a food removes all allergens or will cure itching.', 'Recommend veterinary involvement for diagnostic diet trials and persistent skin disease.'],
    array['food allergy', 'food reaction', 'elimination diet', 'hypoallergenic', 'novel protein', 'hydrolysed diet', 'itch buster', 'sensitive skin'],
    array['sensitive-dog', 'single-protein', 'skin-support', 'hypoallergenic'],
    array['https://allgoodpetfood.co.nz/products/hyp', 'https://allgoodpetfood.co.nz/products/addiction-le-lamb', 'https://allgoodpetfood.co.nz/products/dk'],
    'google-doc-itchy-dog-replies:food-trial', true, 'verified-google-doc'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'What can I do at home for suspected environmental or contact allergies?',
    'Seasonal itching or irritation after outdoor exposure can be consistent with environmental triggers, but veterinary assessment may be needed to exclude parasites, infection and other causes. Practical measures include avoiding freshly cut or long grass when it seems to trigger symptoms, rinsing paws and the belly with cool clean water after walks, drying carefully, and washing bedding regularly. Use only pet-labelled topical products according to their directions, avoid eyes and broken skin, and stop if irritation worsens. Do not recommend homemade acidic or alkaline skin mixtures. A balm, salve, paw soak or itch-soothing spray may provide supportive comfort, but it does not diagnose or treat the underlying allergy.',
    'environmental-allergies',
    'Reduce exposure, rinse and dry affected areas, and use pet-labelled topical support without claiming a cure.',
    array['Which areas are itchy or irritated?', 'Does it worsen after grass exposure or during particular seasons?', 'Is the skin broken, painful, smelly or discharging?', 'Would you like me to check the current balms, salves, soaks or sprays?'],
    array['Do not apply products to eyes or broken skin unless the product label and veterinarian permit it.', 'Stop topical use if irritation worsens.', 'Ongoing, severe or infected skin problems require veterinary care.', 'Do not recommend apple cider vinegar, baking-soda mixtures or other homemade treatments.'],
    array['contact allergy', 'environmental allergy', 'grass', 'pollen', 'itchy paws', 'paw licking', 'itchy belly', 'seasonal itching', 'balm', 'salve', 'spray', 'paw soak'],
    array['skin-support', 'paw-care', 'itch-relief', 'topical'],
    array['https://allgoodpetfood.co.nz/products/holistic-hound-paw-skin-solve-50ml', 'https://allgoodpetfood.co.nz/products/wpb', 'https://allgoodpetfood.co.nz/products/wis', 'https://allgoodpetfood.co.nz/products/holistic-hound-paw-skin-soak-160g'],
    'google-doc-itchy-dog-replies:environmental-support', true, 'verified-google-doc'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'Which chews may suit a dog with food sensitivities?',
    'Choose treats and chews by checking every ingredient against proteins and other ingredients the dog must avoid. During a formal elimination diet, give only treats specifically approved by the veterinarian because even a small amount of another food can invalidate the trial. Outside a diagnostic trial, a clearly labelled single-protein chew that uses a protein the dog has not reacted to may be an option. Confirm the dog''s age, size, chewing style and known sensitivities first. Select an appropriate size, supervise every chew, provide fresh water, and remove small or damaged pieces.',
    'treats-and-chews',
    'Match chews to the dog''s known avoidances, size and chewing style, with supervision and stricter rules during diet trials.',
    array['Which proteins or ingredients must your dog avoid?', 'Are they currently completing a veterinary elimination diet?', 'How old and large is your dog?', 'Are they a strong or fast chewer?'],
    array['Treats can invalidate a diagnostic elimination trial.', 'No chew is risk-free; supervise and remove pieces that could be swallowed.', 'Do not describe a chew as suitable until the dog''s avoidances, age and size are known.'],
    array['hypoallergenic chew', 'sensitive dog treats', 'venison chew', 'venison ear', 'single protein treat', 'dog chew', 'food sensitivity'],
    array['treat', 'chew', 'single-protein', 'venison'],
    array['https://allgoodpetfood.co.nz/products/new-venison-ear-donuts-8-pack-1'],
    'google-doc-itchy-dog-replies:chews', true, 'verified-google-doc'
  )
on conflict do nothing;
