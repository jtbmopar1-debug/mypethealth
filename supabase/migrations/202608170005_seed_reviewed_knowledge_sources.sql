-- Reviewed and generalised from All Good Petfood quick-reply documents,
-- Causes and Solutions for Urinary tract issues in cats, and the internal
-- Food Ingredient Analysis workbook.
--
-- Unsafe or unverified source claims are deliberately not reproduced. In
-- particular, Buddy must not guarantee mouldy food is harmless, replace a
-- veterinarian-prescribed diet, diagnose urinary disease, or select a diet for
-- pancreatitis from an as-fed fat percentage alone.

insert into public.knowledge_entries
  (id, question, answer, category, summary, follow_up_questions, safety_notes, tags, relevant_product_tags, recommended_product_urls, source_candidate_id, enabled, created_by)
values
  (
    '30000000-0000-4000-8000-000000000001',
    'What should I do if pet food appears mouldy, damaged or contaminated?',
    'Tell the customer to stop feeding the affected food immediately and keep the bag, remaining food, receipt or order details, batch or best-before information, and clear photographs. Ask whether any was eaten and whether the pet is unwell. Escalate the case to the All Good Petfood team so they can investigate and confirm the appropriate replacement or refund; do not promise a cause, carrier fault, dispatch date or remedy before the case is checked. Mould cannot be assumed to be harmless because some moulds can produce toxins. If the pet has eaten the food, advise the customer to contact their veterinarian for individual guidance. Vomiting, diarrhoea, loss of appetite, unusual tiredness, drooling, poor coordination, tremors, seizures, yellow gums or eyes, or unexplained bruising or bleeding require prompt veterinary attention.',
    'customer-service',
    'Stop feeding suspect food, preserve evidence, escalate the complaint and never guarantee that visible mould is harmless.',
    array['What product and bag size is it?', 'What are the batch and best-before details?', 'When and where was it purchased?', 'Has your pet eaten any, and are they showing any symptoms?', 'Can you provide photographs of the food and packaging?'],
    array['Never state that mouldy food is non-toxic or safe to feed.', 'Do not ask the customer to taste or smell the food closely.', 'A symptomatic pet or a pet that may have eaten contaminated food needs veterinary advice.', 'Do not promise a replacement, refund or dispatch time until store staff confirm it.'],
    array['mouldy food', 'moldy food', 'damaged bag', 'contaminated food', 'bad batch', 'food complaint', 'replacement', 'refund', 'quality complaint'],
    array[]::text[],
    array[]::text[],
    'quick-replies:mouldy-food', true, 'verified-local-files'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'How can I pause, cancel or change my All Good Petfood subscription?',
    'Customers can use the subscription controls in their All Good Petfood account to skip, reschedule, edit or cancel deliveries. Ask what they want changed, such as the product, quantity, delivery interval or next delivery date. Buddy may explain the available options, but must not claim an account change has been completed unless a live Shopify subscription action confirms success. If the customer cannot make the change, direct the request to the store team with enough detail for staff to help. Never pressure a customer to restart a paused or cancelled subscription.',
    'subscriptions',
    'Explain subscription controls accurately and escalate account changes that Buddy cannot confirm.',
    array['Would you like to pause, skip, reschedule, edit or cancel?', 'Which product or delivery needs changing?', 'What delivery interval would suit you?', 'Are you seeing an error in your account?'],
    array['Do not say a subscription was changed unless the live account action succeeded.', 'Do not invent billing, cancellation or delivery terms.', 'Respect a customer''s decision to pause or cancel.'],
    array['subscription', 'pause subscription', 'cancel subscription', 'skip delivery', 'reschedule', 'delivery interval', 'edit order', 'recurring order'],
    array[]::text[],
    array[]::text[],
    'quick-replies:subscriptions', true, 'verified-local-files'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'What should Buddy say when a subscription is paused on veterinary advice?',
    'Acknowledge the pause and ask whether the customer needs practical help with the existing subscription. The veterinarian''s recommendation takes priority. Buddy may ask, without pressuring the customer, whether they want to share the diagnosed condition or dietary requirements so the store can avoid unsuitable suggestions. Do not suggest that a retail food is equivalent to, or can replace, a veterinary therapeutic diet. Any alternative product should be considered only with the treating veterinarian''s approval.',
    'subscriptions',
    'Respect veterinary advice and never position a retail food as a replacement for a prescribed diet.',
    array['Would you like help pausing or cancelling the next delivery?', 'Did your veterinarian give you any dietary requirements you want us to note?', 'Would you like the store team to contact you?'],
    array['Never contradict the treating veterinarian.', 'Do not claim a retail food works as well as a veterinary therapeutic diet.', 'Do not diagnose the condition from the customer''s brief description.'],
    array['subscription', 'vet recommendation', 'veterinary diet', 'prescription diet', 'therapeutic diet', 'pause order'],
    array[]::text[],
    array[]::text[],
    'quick-replies:subscription-vet-advice', true, 'verified-local-files'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    'Can I try food samples if my pet is fussy or I am considering a new food?',
    'All Good Petfood offers a food-sample product with several dog and cat options. Ask the pet''s species, age or life stage, approximate size, current food, known sensitivities and the type of food the customer wants to try before suggesting a sample selection. Current choices, availability, discount conditions and shipping charges must be taken from the live product page. A sample can help assess acceptance, but it cannot guarantee that a pet will like or medically tolerate the full diet. Any change of food should be introduced gradually unless a veterinarian directs otherwise.',
    'product-selection',
    'Use live sample options to help customers trial palatability without guaranteeing acceptance or suitability.',
    array['Is the sample for a dog or cat?', 'How old and large are they?', 'What are they eating now?', 'Do they have any known sensitivities or veterinary diet requirements?'],
    array['Never guarantee that a pet will like a food.', 'A sample is not a diagnostic food trial.', 'Use current live terms for sample price, discount and shipping.'],
    array['food sample', 'free sample', 'fussy dog', 'fussy cat', 'try before buying', 'sample bag'],
    array['sample', 'dog-food', 'cat-food'],
    array['https://allgoodpetfood.co.nz/products/free-food-samples'],
    'quick-replies:food-samples', true, 'verified-local-files'
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    'What home dental-care products may help my dog or cat?',
    'Regular home dental care can reduce plaque and tartar, but it does not replace veterinary oral examinations or professional treatment when dental disease is present. Ask whether the pet is a dog or cat, their age and size, whether they have painful, loose or broken teeth, bleeding gums, bad breath, difficulty eating, or known dental disease, and what home care they tolerate. Brushing with a pet-safe product is a useful foundation when the veterinarian says it is appropriate. Dental diets and products with evidence for plaque or tartar control can be considered; the Veterinary Oral Health Council seal is a useful evidence marker. Match any chew to the dog''s size and chewing style, supervise it, and avoid presenting very hard bones, hooves or chews as risk-free dental treatment. Cats should receive cat-specific products.',
    'dental-care',
    'Match evidence-based dental support to the individual pet and keep veterinary examination and tooth-fracture risks in view.',
    array['Is this for a dog or cat, and how old and large are they?', 'Are there painful, loose or broken teeth, bleeding gums, bad breath or trouble eating?', 'Will they tolerate brushing?', 'Has a veterinarian checked their mouth recently?', 'Would you like me to show current dental diets or dental-care products?'],
    array['Pain, facial swelling, bleeding, loose or broken teeth, or difficulty eating needs veterinary assessment.', 'Dental diets and chews do not remove the need for veterinary dental care.', 'No chew is risk-free; supervise and choose an appropriate size and hardness.', 'Never recommend human toothpaste for pets.'],
    array['dental', 'teeth', 'tooth', 'plaque', 'tartar', 'bad breath', 'dental food', 'dental chew', 'oral care', 'brushing'],
    array['dental', 'oral-care'],
    array['https://allgoodpetfood.co.nz/products/natura-dental-weight-management', 'https://allgoodpetfood.co.nz/products/royal-canin-dental-care-adult-dry-cat-food'],
    'quick-replies:dental-care', true, 'verified-local-files'
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    'Which All Good Petfood options can I consider for a dog with food sensitivities?',
    'First ask what the dog currently eats, every protein previously fed, known reactions, age, size and whether a veterinarian is running a formal elimination trial. The store range includes fish, lamb, kangaroo, venison and vegetarian-labelled options in different kibble sizes, but no retail product should be described as allergy-proof or automatically suitable. During a veterinary elimination trial, recommend only the exact diet and treats approved by the veterinarian. Otherwise, use the live catalogue to show in-stock options whose full ingredient lists avoid the customer''s known exclusions, explain that recipes can contain more than the named protein, and suggest a gradual transition.',
    'product-selection',
    'Filter the live sensitive-food range by prior proteins, exclusions, life stage and size instead of calling every product hypoallergenic.',
    array['What food and proteins has your dog eaten before?', 'Which ingredients must they avoid?', 'Are they on a veterinary elimination trial?', 'How old and large are they?', 'Do they prefer a smaller kibble?'],
    array['Do not call a product allergy-proof.', 'Check the current full ingredient list, not only the product name or front-label protein.', 'Only the veterinarian should select products during a diagnostic elimination trial.', 'Do not promise that a food will cure itching or digestive disease.'],
    array['sensitive food', 'hypoallergenic food', 'alternative protein', 'fish food', 'lamb food', 'kangaroo food', 'venison food', 'small breed food', 'itch buster'],
    array['sensitive-dog', 'single-protein', 'skin-support', 'small-breed'],
    array['https://allgoodpetfood.co.nz/products/hyp', 'https://allgoodpetfood.co.nz/products/addiction-salmon-bleu-dog', 'https://allgoodpetfood.co.nz/products/addiction-le-lamb', 'https://allgoodpetfood.co.nz/products/dk', 'https://allgoodpetfood.co.nz/products/dv', 'https://allgoodpetfood.co.nz/products/af71360', 'https://allgoodpetfood.co.nz/products/af71414', 'https://allgoodpetfood.co.nz/products/af71513'],
    'quick-replies:sensitive-food-options', true, 'verified-local-files'
  ),
  (
    '30000000-0000-4000-8000-000000000007',
    'What food should a dog with pancreatitis eat?',
    'Pancreatitis is a veterinary condition and diet choice should follow the treating veterinarian''s plan, particularly during or soon after a flare. Ask whether pancreatitis was diagnosed, whether symptoms are current, what the veterinarian prescribed, the dog''s other conditions, and the exact current food. Dogs with vomiting, abdominal pain, marked lethargy, weakness, refusal to eat or suspected recurrence need prompt veterinary advice rather than a retail recommendation. For dogs, veterinary references commonly express fat targets as grams per 1,000 kilocalories or on a dry-matter basis; an as-fed percentage by itself is not enough to compare wet and dry foods. The internal label reference lists Natura PancreaCare at 3,351 kcal/kg and crude fat minimum 9% as fed, which is approximately 26.9 g minimum fat per 1,000 kcal. Buddy must not independently declare it suitable for a particular pancreatitis patient from the product name, the type of fat, reviews or marketing claims. It may be discussed only for the customer to review with their veterinarian.',
    'pancreatitis',
    'Keep pancreatitis diet selection veterinarian-led and compare fat on an energy or dry-matter basis, not as-fed percentage alone.',
    array['Was pancreatitis diagnosed by a veterinarian?', 'Is your dog having symptoms now?', 'What diet and fat target did your veterinarian recommend?', 'What exact food are they eating now?', 'Do they have diabetes, high blood fats or another medical condition?'],
    array['Active or suspected pancreatitis requires veterinary care.', 'Do not claim that unsaturated fat makes a food automatically safe for pancreatitis.', 'Do not compare wet and dry foods using as-fed fat percentage alone.', 'Do not claim AAFCO approval establishes that a food is a therapeutic pancreatic diet.', 'A product recommendation requires the treating veterinarian''s approval.'],
    array['pancreatitis', 'pancreatic dog', 'pancreacare', 'low fat food', 'fat percentage', 'fat per calorie', 'schnauzer'],
    array['pancreatitis', 'low-fat'],
    array['https://allgoodpetfood.co.nz/products/naturapancreacare'],
    'quick-replies:pancreatitis-food', true, 'verified-local-files'
  ),
  (
    '30000000-0000-4000-8000-000000000008',
    'Which treats are suitable for a dog with pancreatitis or a prescribed low-fat diet?',
    'Use only treats that fit the treating veterinarian''s fat and calorie allowance. Ask for the veterinarian''s target, the exact daily diet, whether the dog has had a recent flare, and the dog''s size before suggesting anything. Compare products using verified current nutritional data on the same basis; as-fed percentages cannot fairly compare foods with different moisture or calorie content. Keep treats small and within the veterinarian''s calorie allowance. Do not infer suitability from words such as natural, fish, lean or healthy, and do not use estimated supplier values as fact. If verified data are unavailable, say so and do not recommend the treat for pancreatitis.',
    'pancreatitis',
    'Only suggest treats that meet the individual veterinary plan using verified comparable nutrition data.',
    array['What fat and calorie limits did your veterinarian give you?', 'Has your dog had a recent flare?', 'What is their current prescribed diet?', 'How much do they weigh?'],
    array['Recent or active pancreatitis needs veterinary guidance.', 'Do not use guessed or typical treat values.', 'Do not assume fish or unsaturated-fat treats are safe.', 'Treat calories must be included in the total daily plan.'],
    array['pancreatitis treats', 'low fat treats', 'pancreatic dog treats', 'treat fat', 'lean treats'],
    array['low-fat', 'treat'],
    array[]::text[],
    'quick-replies:pancreatitis-treats', true, 'verified-local-files'
  ),
  (
    '30000000-0000-4000-8000-000000000009',
    'What should I do if my cat has urinary signs, crystals, stones or a suspected UTI?',
    'Urinary signs in cats can have several causes and cannot be diagnosed from chat. Ask whether the cat is passing a normal amount of urine, how often they visit the tray, whether there is straining, crying, blood, licking, urinating outside the tray, vomiting, hiding, weakness or loss of appetite, and whether a veterinarian has diagnosed crystals, stones, infection or another condition. A cat that repeatedly strains but passes little or no urine, especially a male cat, may have a life-threatening urethral obstruction and needs emergency veterinary care immediately. Retail maintenance foods are not substitutes for a prescribed urinary diet. DL-methionine can acidify urine, but it must not be suggested without veterinary direction because treatment depends on the urine and stone type and excessive acidification can be harmful. Encourage fresh water and follow the veterinarian''s exact diet and medication plan.',
    'feline-urinary-health',
    'Treat inability to pass urine as an emergency and keep diagnosis, urine acidification and therapeutic diets veterinarian-led.',
    array['Is your cat passing a normal amount of urine right now?', 'Are they straining, crying or making repeated tray visits?', 'Is there blood, vomiting, weakness, hiding or loss of appetite?', 'Has a veterinarian diagnosed the cause or prescribed a urinary diet?', 'Is your cat male or female?'],
    array['Little or no urine with repeated straining is an emergency, especially in male cats.', 'Do not diagnose a UTI from urinary signs alone.', 'Do not recommend DL-methionine or another urine acidifier without veterinary direction.', 'Do not replace a prescribed urinary diet with a retail maintenance food.'],
    array['cat UTI', 'cat urinary', 'urine', 'straining', 'blocked cat', 'urethral obstruction', 'crystals', 'struvite', 'bladder stones', 'DL-methionine'],
    array[]::text[],
    array[]::text[],
    'local-text:feline-urinary-tract', true, 'verified-local-files'
  ),
  (
    '30000000-0000-4000-8000-000000000010',
    'How should Buddy interpret the internal food nutrition figures?',
    'The workbook records metabolisable energy in kcal/kg and guaranteed-analysis values for crude protein and crude fat minimums, crude fibre and moisture maximums, plus calcium, phosphorus and sodium where supplied. Decimal values such as 0.26 mean 26%. These are label-reference figures, not full ingredient lists and not laboratory certificates. Minimum and maximum guarantees are not exact measured amounts. Compare products on the same basis; wet and dry products should not be compared using as-fed percentages alone. For medical questions, calculate or obtain dry-matter and energy-basis values and defer the final diet decision to the veterinarian. Recheck the current package or manufacturer data before quoting a value because recipes can change.',
    'product-nutrition',
    'Treat workbook figures as label references, convert decimals to percentages correctly and avoid invalid wet-versus-dry or medical comparisons.',
    array['Which exact product and life-stage formula do you mean?', 'Are you comparing dry foods, wet foods or both?', 'Is this for a diagnosed medical condition?', 'Would you like the value as fed, on a dry-matter basis or per 1,000 kcal?'],
    array['Guaranteed-analysis minimums and maximums are not exact measured nutrient amounts.', 'Do not use as-fed values alone for medical diet selection.', 'Verify the current label or manufacturer data before quoting figures.'],
    array['nutrition analysis', 'guaranteed analysis', 'calories per kg', 'protein percentage', 'fat percentage', 'fibre', 'moisture', 'calcium phosphorus', 'sodium'],
    array[]::text[],
    array[]::text[],
    'food-analysis:interpretation', true, 'verified-local-files'
  ),
  (
    '30000000-0000-4000-8000-000000000011',
    'What are the internal nutrition reference figures for Natura dry dog foods?',
    'Internal label reference, as fed unless stated: Grain Be Gone — 3,104 kcal/kg, protein min 26%, fat min 10%, fibre max 4%, moisture max 10%, calcium-to-phosphorus ratio 1.4:1, sodium 0.3%. Itch Buster — 3,351 kcal/kg, protein 26%, fat 9%, fibre 4%, moisture 10%, ratio 1.7:1, sodium 0.3%. PancreaCare — the same listed figures as Itch Buster. Maintenance — 2,884 kcal/kg, protein 20%, fat 10%, fibre 4%, moisture 10%, ratio 1.4:1, sodium 0.3%. Active — 5,187 kcal/kg, protein 35%, fat 15%, fibre 4%, moisture 10%, ratio 1.5:1, sodium 0.3%. Everyday Gourmet — 3,400 kcal/kg, protein 25%, fat 15%, fibre 5%, moisture 10%; mineral figures not supplied. Grain-Free Gourmet — 3,400 kcal/kg, protein 27%, fat 17%, fibre 5%, moisture 10%; mineral figures not supplied. Puppy — 3,200 kcal/kg, protein 27.5%, fat 10%, fibre 4%, moisture 10%, ratio 1.7:1, sodium 0.3%. Recheck the current product label before quoting or comparing.',
    'product-nutrition',
    'Internal guaranteed-analysis reference for Natura dry dog foods.',
    array['Which Natura formula are you asking about?', 'Is this a general comparison or for a veterinary condition?', 'Would you like the values converted to an energy basis?'],
    array['These are label-reference minimums and maximums, not exact measured values.', 'Recheck the current label before quoting.', 'Do not select a medical diet from these figures alone.'],
    array['Natura Grain Be Gone', 'Natura Itch Buster', 'Natura PancreaCare', 'Natura Maintenance', 'Natura Active', 'Natura Everyday Gourmet', 'Natura Grain-Free Gourmet', 'Natura Puppy', 'Natura nutrition'],
    array['natura', 'dog-food'],
    array['https://allgoodpetfood.co.nz/products/hyp', 'https://allgoodpetfood.co.nz/products/naturapancreacare', 'https://allgoodpetfood.co.nz/products/natura-maintenance'],
    'food-analysis:natura-dog', false, 'internal-workbook-draft'
  ),
  (
    '30000000-0000-4000-8000-000000000012',
    'What are the internal nutrition reference figures for Addiction dry dog foods?',
    'Internal label reference, as fed: Salmon Bleu Puppy — 3,490 kcal/kg, protein min 26%, fat min 12%, fibre max 3%, moisture max 10%. Salmon Bleu Adult — 3,460 kcal/kg, 24%, 13%, 3%, 10%. Le Lamb — 3,260 kcal/kg, 22%, 12%, 3%, 10%. Kangaroo and Apple — 3,240 kcal/kg, 22%, 11%, 6%, 10%. Viva La Venison — 4,285 kcal/kg, 26%, 14%, 3.5%, 10%. Mega Grain Free Beef — 3,285 kcal/kg, 20%, 13%, 4%, 10%. Zen Vegetarian — 3,300 kcal/kg, 22%, 9%, 7.5%, 10%. Wild Islands Highland Meats, Island Birds, Pacific Catch and Forest Meats — each listed at 3,950 kcal/kg, 40%, 15%, 4%, 10%. Le Lamb Small Dog — 3,450 kcal/kg, 22%, 12%, 3%, 10%. Viva La Venison Small Dog — 3,450 kcal/kg, 24%, 12%, 4%, 10%. Chicken Mega Adult — 3,800 kcal/kg, 24%, 13%, 4%, 10%. Chicken Mega Senior — 3,400 kcal/kg, 28%, 10%, 4%, 10%. Chicken Mega Medium/Large Breed Puppy — 3,800 kcal/kg, 24%, 13%, 4%, 10%. Duck Royale Small Dog — 3,500 kcal/kg, 30%, 14%, 4%, 10%. Mineral figures were not supplied. Recheck the current product label before quoting.',
    'product-nutrition',
    'Internal calorie and guaranteed-analysis reference for Addiction dry dog foods.',
    array['Which Addiction dog formula do you mean?', 'What is your dog''s age and size?', 'Is this a general comparison or for a veterinary condition?'],
    array['These are label-reference minimums and maximums.', 'Mineral values were not supplied.', 'Recheck the current label before quoting.', 'Do not select a medical diet from these figures alone.'],
    array['Addiction Salmon Bleu dog', 'Addiction Le Lamb', 'Addiction Kangaroo Apple', 'Addiction Viva La Venison dog', 'Addiction Mega dog', 'Addiction Zen Vegetarian', 'Addiction Wild Islands dog', 'Addiction small breed', 'Addiction dog nutrition'],
    array['addiction', 'dog-food'],
    array['https://allgoodpetfood.co.nz/products/addiction-salmon-bleu-dog', 'https://allgoodpetfood.co.nz/products/addiction-le-lamb', 'https://allgoodpetfood.co.nz/products/dk', 'https://allgoodpetfood.co.nz/products/dv', 'https://allgoodpetfood.co.nz/products/addictionzen', 'https://allgoodpetfood.co.nz/products/wildislandspacificcatch', 'https://allgoodpetfood.co.nz/products/wildislandforestmeat'],
    'food-analysis:addiction-dog', false, 'internal-workbook-draft'
  ),
  (
    '30000000-0000-4000-8000-000000000013',
    'What are the internal nutrition reference figures for Addiction dry cat foods?',
    'Internal label reference, as fed: Addiction Duck Royale — 3,320 kcal/kg, protein min 30%, fat min 16%, fibre max 3.5%, moisture max 10%. Salmon Bleu — 3,700 kcal/kg, 30%, 15%, 4%, 10%. Viva La Venison — 3,500 kcal/kg, 30%, 15%, 6.5%, 10%. Chicken Supreme — 3,700 kcal/kg, 40%, 15%, 5%, 10%. Wishbone Roost — 3,640 kcal/kg, 32%, 15%, 5%, 10%. Wild Islands Forest Meats — 4,140 kcal/kg, 42%, 15%, 5%, 10%. Highland Meats — 4,100 kcal/kg, 42%, 15%, 5%, 10%. Pacific Catch — 4,060 kcal/kg, 45%, 15%, 5%, 10%. Island Bird — 4,100 kcal/kg, 45%, 15%, 5%, 10%. Mineral figures were not supplied. Recheck the current product label before quoting.',
    'product-nutrition',
    'Internal calorie and guaranteed-analysis reference for Addiction dry cat foods.',
    array['Which Addiction cat formula do you mean?', 'How old is your cat?', 'Is this a general comparison or for a veterinary condition?'],
    array['These are label-reference minimums and maximums.', 'Mineral values were not supplied.', 'Recheck the current label before quoting.', 'Veterinary urinary or renal diets must be selected by the veterinarian.'],
    array['Addiction Duck Royale cat', 'Addiction Salmon Bleu cat', 'Addiction Viva La Venison cat', 'Addiction Chicken Supreme cat', 'Wishbone Roost', 'Addiction Wild Islands cat', 'Addiction cat nutrition'],
    array['addiction', 'cat-food'],
    array[]::text[],
    'food-analysis:addiction-cat', false, 'internal-workbook-draft'
  ),
  (
    '30000000-0000-4000-8000-000000000014',
    'What are the internal nutrition reference figures for Black Hawk adult dry dog foods?',
    'Internal label reference, as fed. Grain Free Lamb Adult and Grain Free Kangaroo Adult — 3,700 kcal/kg, protein min 28%, fat min 18%, fibre max 2%, moisture max 10%, calcium 2.3%, phosphorus 1.3%. Grain Free Chicken Adult — 3,680 kcal/kg, 28%, 18%, 2%, 10%, calcium 2.0%, phosphorus 1.2%. Grain Free Small Breed Chicken — 3,680 kcal/kg, 28%, 18%, 4.5%, 10%, calcium 2.5%, phosphorus 1.4%. Grain Free Salmon Adult — 3,750 kcal/kg, 28%, 18%, 2%, 10%, calcium 2.0%, phosphorus 1.2%. Grain Free Large Breed Chicken — 3,650 kcal/kg, 27%, 17%, 4.5%, 10%, calcium 2.5%, phosphorus 1.5%. Adult Fish and Potato — 3,690 kcal/kg, 22%, 14%, 4.5%, 10%, calcium 2.1%, phosphorus 1.1%. Small Breed Lamb and Rice and Adult Lamb and Rice — 3,870 and 3,770 kcal/kg respectively; both 25% protein, 17% fat, 4.5% fibre, 10% moisture, calcium 2.5%, phosphorus 1.4%. Adult Chicken and Rice — 3,590 kcal/kg, 22%, 12%, 4.5%, 10%, calcium 1.54%, phosphorus 0.85%. Sodium was not supplied. Recheck the current label before quoting.',
    'product-nutrition',
    'Internal calorie, guaranteed-analysis and mineral reference for Black Hawk adult dog foods.',
    array['Which exact Black Hawk formula and bag do you mean?', 'What is your dog''s age and size?', 'Is this a general comparison or for a veterinary condition?'],
    array['These are label-reference minimums and maximums.', 'Sodium was not supplied.', 'Recheck the current label before quoting.', 'Do not select a medical diet from these figures alone.'],
    array['Black Hawk Grain Free Lamb', 'Black Hawk Grain Free Kangaroo', 'Black Hawk Grain Free Chicken', 'Black Hawk Grain Free Salmon', 'Black Hawk Fish Potato', 'Black Hawk Lamb Rice', 'Black Hawk Chicken Rice', 'Black Hawk adult nutrition'],
    array['black-hawk', 'dog-food'],
    array[]::text[],
    'food-analysis:blackhawk-adult-dog', false, 'internal-workbook-draft'
  ),
  (
    '30000000-0000-4000-8000-000000000015',
    'What are the internal nutrition reference figures for Black Hawk Healthy Benefits dog foods?',
    'Internal label reference, as fed: Healthy Benefits Dental — 3,670 kcal/kg, protein min 28%, fat min 17%, fibre max 8%, moisture max 10%, calcium 0.9%, phosphorus 0.7%. Joints and Muscles — 3,770 kcal/kg, 28%, 17%, 5%, 10%, calcium 0.9%, phosphorus 0.7%. Weight Management — 3,260 kcal/kg, 28%, 11%, 11%, 10%, calcium 0.9%, phosphorus 0.7%. Sensitive Skin and Gut — 3,700 kcal/kg, 28%, 17%, 6%, 10%, calcium 0.9%, phosphorus 0.7%. Sodium was not supplied. Product names describe their retail positioning but do not establish suitability for a diagnosed condition. Recheck the current label before quoting.',
    'product-nutrition',
    'Internal calorie, guaranteed-analysis and mineral reference for Black Hawk Healthy Benefits dog foods.',
    array['Which Healthy Benefits formula do you mean?', 'Is this for general support or a diagnosed condition?', 'What is your dog''s age, size and current food?'],
    array['Product names do not establish medical suitability.', 'These are label-reference minimums and maximums.', 'Recheck the current label before quoting.'],
    array['Black Hawk Healthy Benefits Dental', 'Black Hawk Joints Muscles', 'Black Hawk Weight Management dog', 'Black Hawk Sensitive Skin Gut', 'Healthy Benefits dog nutrition'],
    array['black-hawk', 'dog-food'],
    array[]::text[],
    'food-analysis:blackhawk-healthy-benefits-dog', false, 'internal-workbook-draft'
  ),
  (
    '30000000-0000-4000-8000-000000000016',
    'What are the internal nutrition reference figures for Black Hawk puppy foods?',
    'Internal label reference, as fed: Small Breed Puppy Lamb and Rice — 3,790 kcal/kg, protein min 30%, fat min 19%, fibre max 4.5%, moisture max 10%, calcium 1.6%, phosphorus 1.0%. Small Breed Puppy Chicken and Rice — 3,740 kcal/kg, 30%, 18%, 4.5%, 10%, calcium 1.3%, phosphorus 1.0%. Grain Free Puppy Ocean Fish — 3,640 kcal/kg, 27%, 17%, 4.5%, 10%, calcium 2.5%, phosphorus 1.4%. Large Breed Puppy Lamb and Rice — 3,620 kcal/kg, 27%, 16%, 5.5%, 10%, calcium 1.3%, phosphorus 1.0%. Medium Breed Puppy Lamb and Rice — 3,790 kcal/kg, 30%, 19%, 4.5%, 10%, calcium 1.6%, phosphorus 1.0%. Large Breed Puppy Chicken and Rice — 3,600 kcal/kg, 29%, 16%, 5.5%, 10%, calcium 1.3%, phosphorus 1.0%. Medium Breed Puppy Chicken and Rice — 3,740 kcal/kg, 30%, 18%, 4.5%, 10%, calcium 1.3%, phosphorus 1.0%. Sodium was not supplied. Select the formula for the puppy''s expected adult size and recheck the current label.',
    'product-nutrition',
    'Internal calorie, guaranteed-analysis and mineral reference for Black Hawk puppy foods.',
    array['How old is the puppy?', 'What breed and expected adult size are they?', 'Which exact Black Hawk puppy formula do you mean?', 'What are they eating now?'],
    array['Large-breed puppy nutrition needs particular care.', 'These are label-reference minimums and maximums.', 'Recheck the current label before quoting.'],
    array['Black Hawk puppy', 'Black Hawk small breed puppy', 'Black Hawk medium breed puppy', 'Black Hawk large breed puppy', 'Black Hawk Ocean Fish puppy', 'puppy nutrition'],
    array['black-hawk', 'puppy'],
    array[]::text[],
    'food-analysis:blackhawk-puppy', false, 'internal-workbook-draft'
  ),
  (
    '30000000-0000-4000-8000-000000000017',
    'What are the internal nutrition reference figures for Black Hawk dry cat foods?',
    'Internal label reference, as fed: Healthy Benefits Hairball Chicken — 3,880 kcal/kg, protein min 32%, fat min 16%, fibre max 7.5%, moisture max 10%, calcium 1.2%, phosphorus 1.0%. Healthy Benefits Indoor Chicken — 3,840 kcal/kg, 34%, 14%, 5.5%, 10%, calcium 1.2%, phosphorus 1.0%. Healthy Benefits Weight Management — 3,585 kcal/kg, 35%, 11%, 8.5%, 10%, calcium 1.2%, phosphorus 1.0%. Original Chicken — 4,035 kcal/kg, 32%, 16%, 3.5%, 10%, calcium 1.0%, phosphorus 0.9%. Original Ocean Fish — 3,975 kcal/kg, 32%, 16%, 3.5%, 10%, calcium 1.2%, phosphorus 1.0%. Original Chicken and Kangaroo — 3,955 kcal/kg, 33%, 16%, 4.5%, 10%, calcium 1.2%, phosphorus 1.0%. Original Kitten Chicken — 4,120 kcal/kg, 34%, 18%, 3.5%, 10%, calcium 1.2%, phosphorus 1.0%. Sodium was not supplied. Recheck the current label before quoting.',
    'product-nutrition',
    'Internal calorie, guaranteed-analysis and mineral reference for Black Hawk cat foods.',
    array['Which exact Black Hawk cat formula do you mean?', 'How old is your cat?', 'Is this a general comparison or for a veterinary condition?'],
    array['These are label-reference minimums and maximums.', 'Sodium was not supplied.', 'Recheck the current label before quoting.', 'Do not use these figures to replace a prescribed urinary or renal diet.'],
    array['Black Hawk Hairball cat', 'Black Hawk Indoor cat', 'Black Hawk Weight Management cat', 'Black Hawk Original Chicken cat', 'Black Hawk Ocean Fish cat', 'Black Hawk Chicken Kangaroo cat', 'Black Hawk Kitten', 'Black Hawk cat nutrition'],
    array['black-hawk', 'cat-food'],
    array[]::text[],
    'food-analysis:blackhawk-cat', false, 'internal-workbook-draft'
  ),
  (
    '30000000-0000-4000-8000-000000000018',
    'What guaranteed-analysis figures are verified internally for selected natural treats?',
    'Internal as-fed label reference. Beef: Beef Ear — protein min 80.1%, fat min 7.1%, fibre max 2.1%, moisture max 13.5%. Bully Stick 15 cm — 98.8%, 2.3%, 1.2%, 8.8%. Steer Stick — 80.4%, 15.9%, 1.1%, 8.8%. Beef Paddywack — 91.8%, 11.6%, 5.0%, 6.3%. Beef Jerky and Beef Liver — each 75.0%, 16.8%, 0.5%, 6.3%. Cow Hoof — 97.2%, 1.7%, 21.2%, 6.0%. Beef Fill-A-Chews — 62.2%, 19.7%, 2.3%, 1.5%. Veal: Veal Cookies — 62.8%, 10.3%, 1.5%, 7.4%. Veal Snackos — 69.3%, 18.7%, 1.2%, 5.4%. Lamb: Lamb Ears — 51.4%, 45.0%, 0.9%, 3.6%. Lamb Tripe — 49.4%, 42.5%, 0.7%, 4.5%. Lamb Lung Marshmallows — 75.3%, 11.4%, 0.7%, 8.6%. Recheck the current package or supplier specification before quoting. The workbook''s Veal Tails row is excluded because its protein figure appears inconsistent, and AI-estimated values in the separate Treats sheet are not verified.',
    'product-nutrition',
    'Verified internal guaranteed-analysis reference for selected beef, veal and lamb treats, with suspect and estimated rows excluded.',
    array['Which exact treat and pack size do you mean?', 'Is your veterinarian limiting fat or calories?', 'Does your pet have a known protein sensitivity?', 'What is your dog''s size and chewing style?'],
    array['Recheck the current package or supplier data before quoting.', 'Guaranteed-analysis minimums and maximums are not exact measured amounts.', 'Do not use unverified estimated values.', 'Do not recommend a treat for pancreatitis from as-fed fat alone.', 'Supervise chews and choose an appropriate size and hardness.'],
    array['Beef Ear nutrition', 'Bully Stick nutrition', 'Steer Stick nutrition', 'Beef Paddywack nutrition', 'Beef Jerky nutrition', 'Beef Liver nutrition', 'Cow Hoof nutrition', 'Fill-A-Chew nutrition', 'Veal Cookies nutrition', 'Veal Snackos nutrition', 'Lamb Ears nutrition', 'Lamb Tripe nutrition', 'Lamb Marshmallows nutrition', 'treat fat'],
    array['treat', 'chew'],
    array[]::text[],
    'food-analysis:natural-treats', false, 'internal-workbook-draft'
  )
on conflict do nothing;
